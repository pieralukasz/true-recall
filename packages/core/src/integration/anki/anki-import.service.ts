import { AnkiConverterService } from "@true-recall/core/integration/anki/anki-converter.service";
import { AnkiNoteTypeMapper } from "@true-recall/core/integration/anki/anki-note-type-mapper";
import { AnkiSchedulingService } from "@true-recall/core/integration/anki/anki-scheduling.service";
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import { generateUUID } from "@true-recall/core/persistence/sqlite/sqlite.types";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	AnkiCard,
	AnkiImportOptions,
	AnkiImportResult,
	AnkiRevlogEntry,
	ConvertedCard,
	FSRSCardData,
} from "@true-recall/core/types";
import { AnkiMediaService, type IVaultFileReader } from "./anki-media.service";
import { ApkgParserService } from "./apkg/apkg-parser.service";

const IMPORT_FOLDER = "Anki Import";
const MAX_FILENAME_LENGTH = 60;

/**
 * Handles vault-level file operations needed for Anki import (creating notes, frontmatter, etc.).
 * Obsidian: wraps app.vault, app.metadataCache, app.fileManager.
 */
export interface IAnkiImportVault {
	exists(path: string): Promise<boolean>;
	ensureFolderRecursive(folderPath: string): Promise<void>;
	createFile(path: string, content: string): Promise<void>;
	readFile(path: string): Promise<string>;
	appendToFile(path: string, content: string): Promise<void>;
	prependToFile(path: string, content: string): Promise<void>;
	getFrontmatterUid(path: string): Promise<string | null>;
	addParentToFrontmatter(path: string, parentName: string): Promise<void>;
}

export type CardChangeNotifier = (change: {
	type: "bulk";
	cardIds: string[];
	action: "added";
}) => void;

interface ImportedNoteGroup {
	ankiNoteId: number;
	deckName: string;
	cardIds: string[];
	fields: Record<string, string>;
	cardType: "basic" | "cloze" | "reversed";
	clozeTemplate?: string;
}

export class AnkiImportService {
	constructor(
		private store: SqliteStoreService,
		private fsrsService: FSRSService,
		private persistence: IPersistence,
		private vault: IAnkiImportVault,
		private fileReader?: IVaultFileReader,
		private onCardChange?: CardChangeNotifier,
	) {}

	async importApkg(
		fileData: ArrayBuffer,
		options: AnkiImportOptions,
	): Promise<AnkiImportResult> {
		const result: AnkiImportResult = {
			imported: 0,
			skipped: 0,
			duplicates: 0,
			errors: [],
			noteTypesCreated: 0,
		};

		// 1. Parse the .apkg file
		const parser = new ApkgParserService();
		const apkgData = await parser.parseApkg(fileData);

		// 2. Convert Anki notes to cards
		const converter = new AnkiConverterService();
		const convertedCards = converter.convert(apkgData);

		if (convertedCards.length === 0) {
			result.errors.push("No cards found in the .apkg file");
			return result;
		}

		// 3. Import media files (if enabled)
		let mediaPathMapping = new Map<string, string>();
		if (options.importMedia && apkgData.media.size > 0) {
			const mediaService = new AnkiMediaService(
				this.persistence,
				this.fileReader,
			);
			mediaPathMapping = await mediaService.importMedia(
				apkgData.media,
				apkgData.mediaMap,
				options.mediaFolder,
			);
		}

		// 4. Build revlog lookup: ankiCardId → revlog entries
		const revlogByCard = new Map<number, AnkiRevlogEntry[]>();
		for (const entry of apkgData.revlog) {
			const list = revlogByCard.get(entry.cid) ?? [];
			list.push(entry);
			revlogByCard.set(entry.cid, list);
		}

		// 5. Build AnkiCard lookup for scheduling
		const ankiCardMap = new Map<number, AnkiCard>();
		for (const card of apkgData.cards) {
			ankiCardMap.set(card.id, card);
		}

		// 6. Prepare services
		const schedulingService = new AnkiSchedulingService(this.fsrsService);
		const mediaService = new AnkiMediaService(
			this.persistence,
			this.fileReader,
		);
		const noteTypeMapper = new AnkiNoteTypeMapper(this.store.noteTypes);

		// 7. Process each converted card
		const importedCardIds: string[] = [];
		const noteGroups = new Map<number, ImportedNoteGroup>();

		this.store.transaction(() => {
			noteTypeMapper.mapModels(apkgData.models, options.modelMappings);

			const ankiToTrCardId = new Map<number, string>();
			const ankiNoteToTrNote = new Map<number, string>();

			for (const converted of convertedCards) {
				try {
					const importResult = this.importSingleCard(
						converted,
						ankiCardMap,
						revlogByCard,
						schedulingService,
						mediaService,
						mediaPathMapping,
						options,
						ankiToTrCardId,
						noteTypeMapper,
						ankiNoteToTrNote,
					);

					if (importResult.status === "imported") {
						importedCardIds.push(importResult.cardId);
						result.imported++;

						// Accumulate per-note groups for source note creation
						let group = noteGroups.get(converted.ankiNoteId);
						if (!group) {
							group = {
								ankiNoteId: converted.ankiNoteId,
								deckName: converted.deckName,
								cardIds: [],
								fields: converted.fieldValues,
								cardType: converted.cardType,
								clozeTemplate: converted.clozeTemplate,
							};
							noteGroups.set(converted.ankiNoteId, group);
						}
						group.cardIds.push(importResult.cardId);
					} else if (importResult.status === "duplicate") {
						result.duplicates++;
					} else {
						result.skipped++;
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					result.errors.push(`Card ${converted.ankiCardId}: ${msg}`);
					result.skipped++;
				}
			}

			if (options.importScheduling) {
				this.importReviewLogs(
					convertedCards,
					revlogByCard,
					importedCardIds,
					ankiToTrCardId,
				);
			}
		});

		await this.store.flush();

		// 8. Create source notes in vault (one per Anki note, deck hierarchy as folders)
		if (noteGroups.size > 0) {
			try {
				await this.createSourceNotes(noteGroups);
				await this.store.flush();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				result.errors.push(`Failed to create source notes: ${msg}`);
			}
		}

		if (importedCardIds.length > 0) {
			this.onCardChange?.({
				type: "bulk",
				cardIds: importedCardIds,
				action: "added",
			});
		}

		result.noteTypesCreated = noteTypeMapper.noteTypesCreated;
		return result;
	}

	private importSingleCard(
		converted: ConvertedCard,
		ankiCardMap: Map<number, AnkiCard>,
		revlogByCard: Map<number, AnkiRevlogEntry[]>,
		schedulingService: AnkiSchedulingService,
		mediaService: AnkiMediaService,
		mediaPathMapping: Map<string, string>,
		options: AnkiImportOptions,
		ankiToTrCardId: Map<number, string>,
		noteTypeMapper: AnkiNoteTypeMapper,
		ankiNoteToTrNote: Map<number, string>,
	):
		| { status: "imported"; cardId: string }
		| { status: "duplicate" | "skipped" } {
		let question = converted.question;
		let answer = converted.answer;

		if (mediaPathMapping.size > 0) {
			question = mediaService.updateImportedContent(question, mediaPathMapping);
			answer = mediaService.updateImportedContent(answer, mediaPathMapping);
		}

		if (!question.trim()) {
			return { status: "skipped" };
		}

		const existingId =
			converted.cardType === "cloze" && converted.clozeIndex !== undefined
				? this.store.cards.getCardIdByQuestionAndClozeIndex(
						question,
						converted.clozeIndex,
					)
				: this.store.cards.getCardIdByQuestion(question);
		if (existingId) {
			ankiToTrCardId.set(converted.ankiCardId, existingId);
			return { status: "duplicate" };
		}

		const cardId = generateUUID();
		ankiToTrCardId.set(converted.ankiCardId, cardId);

		let cardData: FSRSCardData;

		if (options.importScheduling) {
			const ankiCard =
				ankiCardMap.get(converted.ankiCardId) ??
				this.buildMinimalAnkiCard(converted);
			const revlogs = revlogByCard.get(converted.ankiCardId) ?? [];
			cardData = schedulingService.convert(cardId, ankiCard, revlogs);
		} else {
			cardData = this.fsrsService.createNewCard(cardId);
		}

		cardData.question = question;
		cardData.answer = answer;
		cardData.cardType = converted.cardType;

		const fieldValues: Record<string, string> = {};
		for (const [key, value] of Object.entries(converted.fieldValues)) {
			fieldValues[key] =
				mediaPathMapping.size > 0
					? mediaService.updateImportedContent(value, mediaPathMapping)
					: value;
		}

		const noteTypeId = noteTypeMapper.getNoteTypeId(converted.ankiModelId);

		let noteId = ankiNoteToTrNote.get(converted.ankiNoteId);
		if (!noteId) {
			noteId = generateUUID();
			ankiNoteToTrNote.set(converted.ankiNoteId, noteId);

			if (noteTypeId) {
				this.store.notes.create({
					id: noteId,
					noteTypeId,
					fields: fieldValues,
					tags: converted.tags,
					createdVia: "anki_import",
				});
			}
		}

		if (noteTypeId) {
			cardData.noteTypeId = noteTypeId;
			cardData.noteId = noteId;
			cardData.templateOrd = converted.templateOrd;
			cardData.fields = fieldValues;
		}

		if (converted.cardType === "cloze") {
			let clozeTemplate = converted.clozeTemplate ?? question;
			if (mediaPathMapping.size > 0) {
				clozeTemplate = mediaService.updateImportedContent(
					clozeTemplate,
					mediaPathMapping,
				);
			}
			cardData.clozeTemplate = clozeTemplate;
			cardData.clozeIndex = converted.clozeIndex;
		}

		if (
			converted.cardType === "reversed" &&
			converted.reverseOfAnkiCardId !== undefined
		) {
			const originalTrId = ankiToTrCardId.get(converted.reverseOfAnkiCardId);
			if (originalTrId) {
				cardData.reverseOf = originalTrId;
			}
		}

		cardData.createdVia = "anki_import";
		this.store.set(cardId, cardData);

		return { status: "imported", cardId };
	}

	private importReviewLogs(
		convertedCards: ConvertedCard[],
		revlogByCard: Map<number, AnkiRevlogEntry[]>,
		importedCardIds: string[],
		ankiToTrCardId: Map<number, string>,
	): void {
		const importedSet = new Set(importedCardIds);

		for (const converted of convertedCards) {
			const trCardId = ankiToTrCardId.get(converted.ankiCardId);
			if (!trCardId || !importedSet.has(trCardId)) continue;

			const revlogs = revlogByCard.get(converted.ankiCardId) ?? [];
			const sorted = [...revlogs].sort((a, b) => a.id - b.id);

			for (const entry of sorted) {
				this.store.stats.upsertReviewLogFromRemote({
					id: generateUUID(),
					cardId: trCardId,
					reviewedAt: new Date(entry.id).toISOString(),
					rating: Math.max(1, Math.min(4, entry.ease)),
					scheduledDays: Math.max(0, entry.ivl),
					elapsedDays: Math.max(0, entry.lastIvl),
					state: Math.max(0, Math.min(3, entry.type)),
					timeSpentMs: Math.max(0, entry.time),
					updatedAt: Date.now(),
					deletedAt: null,
					presetName: null,
				});
			}
		}
	}

	/**
	 * Creates one source note per Anki note, organized in deck-based folder hierarchy.
	 *
	 * For deck "Math::Calculus" with 3 notes:
	 *   Anki Import/Math.md                       (MOC with child links)
	 *   Anki Import/Math/Calculus.md               (MOC with child links)
	 *   Anki Import/Math/Calculus/What is X.md     (source note, cards linked)
	 *   Anki Import/Math/Calculus/Derivative.md    (source note, cards linked)
	 *   Anki Import/Math/Calculus/Limit.md         (source note, cards linked)
	 */
	private async createSourceNotes(
		noteGroups: Map<number, ImportedNoteGroup>,
	): Promise<void> {
		const basePath = IMPORT_FOLDER;
		if (!(await this.vault.exists(basePath))) {
			await this.vault.ensureFolderRecursive(basePath);
		}

		// Collect all unique deck paths for folder/MOC creation
		const deckPaths = new Set<string>();
		for (const group of noteGroups.values()) {
			const segments = group.deckName.split("/");
			for (let i = 0; i < segments.length; i++) {
				deckPaths.add(segments.slice(0, i + 1).join("/"));
			}
		}

		// Build parent→children relationships for MOC links
		const parentToChildren = new Map<string, Set<string>>();
		for (const deckPath of deckPaths) {
			const segments = deckPath.split("/");
			if (segments.length > 1) {
				const parentPath = segments.slice(0, -1).join("/");
				if (!parentToChildren.has(parentPath)) {
					parentToChildren.set(parentPath, new Set());
				}
				const childName = segments[segments.length - 1];
				if (childName) {
					parentToChildren.get(parentPath)?.add(childName);
				}
			}
		}

		// Create deck hierarchy (folders + MOC notes), sorted parents-first
		const sortedPaths = [...deckPaths].sort(
			(a, b) => a.split("/").length - b.split("/").length,
		);

		for (const deckPath of sortedPaths) {
			const segments = deckPath.split("/");
			const name = segments[segments.length - 1] ?? "Default";

			const parentSegment =
				segments.length > 1 ? segments[segments.length - 2] : undefined;
			const safeParentName = parentSegment
				? sanitizeFilename(parentSegment)
				: undefined;

			const folderSegments = segments.map((s) => sanitizeFilename(s));
			const folderPath = `${IMPORT_FOLDER}/${folderSegments.join("/")}`;

			if (!(await this.vault.exists(folderPath))) {
				await this.vault.ensureFolderRecursive(folderPath);
			}

			// Create MOC note at deck level
			const mocPath = `${folderPath}.md`;
			const children = parentToChildren.get(deckPath);

			if (!(await this.vault.exists(mocPath))) {
				const uid = this.generateUid();
				const frontmatter = this.buildFrontmatter(uid, safeParentName);
				const childLinks =
					children && children.size > 0
						? [...children]
								.sort()
								.map((c) => `- [[${c}]]`)
								.join("\n")
						: "";
				const body = `# ${name}\n\n${childLinks}`.trim();
				await this.vault.createFile(mocPath, `${frontmatter}\n\n${body}\n`);
			} else if (children && children.size > 0) {
				await this.updateChildLinks(mocPath, children);
			}
		}

		// Create one source note per Anki note
		const usedPaths = new Set<string>();

		for (const group of noteGroups.values()) {
			const deckSegments = group.deckName
				.split("/")
				.map((s) => sanitizeFilename(s));
			const folderPath = `${IMPORT_FOLDER}/${deckSegments.join("/")}`;

			const baseName = deriveNoteName(
				group.fields,
				group.cardType,
				group.clozeTemplate,
			);

			// Ensure unique filename within folder
			let notePath = `${folderPath}/${baseName}.md`;
			let counter = 2;
			while (usedPaths.has(notePath) || (await this.vault.exists(notePath))) {
				notePath = `${folderPath}/${baseName} ${counter}.md`;
				counter++;
			}
			usedPaths.add(notePath);

			const uid = this.generateUid();
			const deckLeafName =
				deckSegments[deckSegments.length - 1] ?? "Anki Import";
			const frontmatter = this.buildFrontmatter(uid, deckLeafName);
			const body = buildNoteContent(group.fields);

			await this.vault.createFile(notePath, `${frontmatter}\n\n${body}\n`);

			// Link all cards from this Anki note to the source note
			for (const cardId of group.cardIds) {
				this.store.cards.updateCardSourceUid(cardId, uid);
			}
		}
	}

	private buildFrontmatter(uid: string, parentName?: string): string {
		const lines = ["---", `flashcard_uid: ${uid}`];
		if (parentName) {
			lines.push("parents:", `  - "[[${parentName}]]"`);
		}
		lines.push("---");
		return lines.join("\n");
	}

	private async updateChildLinks(
		filePath: string,
		children: Set<string>,
	): Promise<void> {
		const content = await this.vault.readFile(filePath);
		const missingChildren = [...children].filter(
			(child) => !content.includes(`[[${child}]]`),
		);
		if (missingChildren.length === 0) return;
		const newLinks = missingChildren
			.map((child) => `- [[${child}]]`)
			.join("\n");
		await this.vault.appendToFile(filePath, `\n${newLinks}\n`);
	}

	private generateUid(): string {
		return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
	}

	private buildMinimalAnkiCard(converted: ConvertedCard) {
		return {
			id: converted.ankiCardId,
			nid: converted.ankiNoteId,
			did: 0,
			ord: 0,
			type: 0,
			queue: 0,
			due: 0,
			ivl: 0,
			factor: 0,
			reps: 0,
			lapses: 0,
		};
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function deriveNoteName(
	fields: Record<string, string>,
	cardType: string,
	clozeTemplate?: string,
): string {
	let raw = "";

	if (cardType === "cloze" && clozeTemplate) {
		// Strip cloze markers: {{c1::text}} → text, {{c1::text::hint}} → text
		raw = clozeTemplate.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "$1");
	} else {
		// Use first field value
		const firstValue = Object.values(fields)[0];
		raw = firstValue ?? "";
	}

	// Strip markdown formatting for filename
	raw = raw
		.replace(/\*\*(.+?)\*\*/g, "$1") // bold
		.replace(/\*(.+?)\*/g, "$1") // italic
		.replace(/~~(.+?)~~/g, "$1") // strikethrough
		.replace(/`(.+?)`/g, "$1") // inline code
		.replace(/!\[\[.+?\]\]/g, "") // embeds
		.replace(/\[\[(.+?)\]\]/g, "$1") // wikilinks
		.replace(/\[(.+?)\]\(.+?\)/g, "$1") // markdown links
		.replace(/\$\$?.+?\$\$?/g, "") // math
		.replace(/\n/g, " "); // newlines to spaces

	raw = raw.trim();

	if (!raw) return "Card";

	return sanitizeFilename(
		raw.length > MAX_FILENAME_LENGTH
			? raw.slice(0, MAX_FILENAME_LENGTH).trim()
			: raw,
	);
}

export function buildNoteContent(fields: Record<string, string>): string {
	return Object.values(fields).filter(Boolean).join("\n\n");
}

function sanitizeFilename(name: string): string {
	return (
		name
			.replace(/[\\/:*?"<>|#^[\]]/g, " ")
			.replace(/\s+/g, " ")
			.trim() || "Default"
	);
}
