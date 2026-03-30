import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import { generateUUID } from "@true-recall/core/persistence/sqlite/sqlite.types";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { AnkiConverterService } from "@true-recall/core/integration/anki/anki-converter.service";
import { AnkiMediaService, type IVaultFileReader } from "./anki-media.service";
import { AnkiNoteTypeMapper } from "@true-recall/core/integration/anki/anki-note-type-mapper";
import { AnkiSchedulingService } from "@true-recall/core/integration/anki/anki-scheduling.service";
import { ApkgParserService } from "./apkg/apkg-parser.service";
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import type {
	AnkiCard,
	AnkiImportOptions,
	AnkiImportResult,
	AnkiRevlogEntry,
	ConvertedCard,
	FSRSCardData,
} from "@true-recall/core/types";

const IMPORT_FOLDER = "Anki Import";

/**
 * Handles vault-level file operations needed for Anki import (creating notes, frontmatter, etc.).
 * Obsidian: wraps app.vault, app.metadataCache, app.fileManager.
 */
export interface IAnkiImportVault {
	/** Check if a file/folder exists at path. */
	exists(path: string): Promise<boolean>;
	/** Create a folder (and parents if needed). */
	ensureFolderRecursive(folderPath: string): Promise<void>;
	/** Create a file with content. */
	createFile(path: string, content: string): Promise<void>;
	/** Read file content. */
	readFile(path: string): Promise<string>;
	/** Append content to an existing file. */
	appendToFile(path: string, content: string): Promise<void>;
	/** Prepend content to an existing file. */
	prependToFile(path: string, content: string): Promise<void>;
	/** Get the flashcard_uid from frontmatter of a file. Returns null if not present. */
	getFrontmatterUid(path: string): Promise<string | null>;
	/** Add a parent link to an existing file's frontmatter. */
	addParentToFrontmatter(path: string, parentName: string): Promise<void>;
}

/** Callback for notifying card changes after import. */
export type CardChangeNotifier = (change: {
	type: "bulk";
	cardIds: string[];
	action: "added";
}) => void;

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
			const mediaService = new AnkiMediaService(this.persistence, this.fileReader);
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
		const mediaService = new AnkiMediaService(this.persistence, this.fileReader);

		// 6.5 Map Anki models → True Recall NoteTypes
		const noteTypeMapper = new AnkiNoteTypeMapper(this.store.noteTypes);

		// 7. Process each converted card
		const importedCardIds: string[] = [];
		const deckToCardIds = new Map<string, string[]>();

		this.store.transaction(() => {
			noteTypeMapper.mapModels(apkgData.models);

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

						const list = deckToCardIds.get(converted.deckName) ?? [];
						list.push(importResult.cardId);
						deckToCardIds.set(converted.deckName, list);
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

		// When "Create project" is enabled, inject ALL deck names (even empty ones)
		// so the full hierarchy is created as projects with parents frontmatter
		if (options.createProject) {
			for (const [, deck] of apkgData.decks) {
				const name = deck.name.replace(/::/g, "/");
				if (name !== "Default" && !deckToCardIds.has(name)) {
					deckToCardIds.set(name, []);
				}
			}
		}

		// Create source notes per deck so imported cards appear in panel/projects
		if (deckToCardIds.size > 0) {
			try {
				await this.createSourceNotesForDecks(deckToCardIds);
				await this.store.flush();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				result.errors.push(`Failed to create project notes: ${msg}`);
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

		// Apply media path updates to question/answer
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

		// Apply media path updates to field values
		const fieldValues: Record<string, string> = {};
		for (const [key, value] of Object.entries(converted.fieldValues)) {
			fieldValues[key] =
				mediaPathMapping.size > 0
					? mediaService.updateImportedContent(value, mediaPathMapping)
					: value;
		}

		// Resolve note type from Anki model
		const noteTypeId = noteTypeMapper.getNoteTypeId(converted.ankiModelId);

		// Share notes across multi-template cards from the same Anki note
		let noteId = ankiNoteToTrNote.get(converted.ankiNoteId);
		if (!noteId) {
			noteId = generateUUID();
			ankiNoteToTrNote.set(converted.ankiNoteId, noteId);

			// Create the note explicitly (CardActions.set() skips note creation when noteId is set)
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
	 * Creates a hierarchical note structure matching the Anki deck hierarchy.
	 *
	 * For deck "Math::Calculus::Integrals":
	 *   Anki Import/Math.md             (MOC, tag: Math)
	 *   Anki Import/Math/Calculus.md    (MOC, tag: Math/Calculus)
	 *   Anki Import/Math/Calculus/Integrals.md  (leaf, tag: Math/Calculus/Integrals)
	 *
	 * Only leaf decks (those with actual cards) get cards linked via source_uid.
	 * Parent-only decks become MOC notes with [[child]] links.
	 */
	private async createSourceNotesForDecks(
		deckToCardIds: Map<string, string[]>,
	): Promise<void> {
		const basePath = IMPORT_FOLDER;
		if (!(await this.vault.exists(basePath))) {
			await this.vault.ensureFolderRecursive(basePath);
		}

		// Collect all hierarchy levels needed
		// Key: full deck path (e.g. "Math/Calculus"), Value: direct children names
		const parentToChildren = new Map<string, Set<string>>();
		const allSegmentPaths = new Set<string>();

		for (const deckName of deckToCardIds.keys()) {
			const segments = deckName.split("/");

			// Register every prefix level
			for (let i = 0; i < segments.length; i++) {
				const path = segments.slice(0, i + 1).join("/");
				allSegmentPaths.add(path);

				// Track parent→child relationships
				if (i > 0) {
					const parentPath = segments.slice(0, i).join("/");
					if (!parentToChildren.has(parentPath)) {
						parentToChildren.set(parentPath, new Set());
					}
					const segmentName = segments[i];
					if (segmentName) {
						parentToChildren.get(parentPath)?.add(segmentName);
					}
				}
			}
		}

		// Hybrid decks: parent has both direct cards AND sub-decks.
		// Move direct cards to a synthetic leaf note so they appear as a member note
		// instead of being invisible on the project-level MOC.
		for (const [deckPath, children] of parentToChildren) {
			const cardIds = deckToCardIds.get(deckPath);
			if (!cardIds || cardIds.length === 0) continue;

			const parentName = deckPath.split("/").pop() ?? deckPath;
			const leafName = children.has(parentName)
				? `${parentName} (Cards)`
				: parentName;

			const leafPath = `${deckPath}/${leafName}`;
			allSegmentPaths.add(leafPath);
			children.add(leafName);

			deckToCardIds.set(leafPath, cardIds);
			deckToCardIds.set(deckPath, []);
		}

		// Create notes for each hierarchy level (sorted so parents are created before children)
		const sortedPaths = [...allSegmentPaths].sort(
			(a, b) => a.split("/").length - b.split("/").length,
		);

		for (const deckPath of sortedPaths) {
			const segments = deckPath.split("/");
			const name = segments[segments.length - 1] ?? "Default";
			const safeName = name.replace(/[\\/:*?"<>|]/g, " - ").trim() || "Default";

			const parentSegment =
				segments.length > 1 ? segments[segments.length - 2] : undefined;
			const safeParentName = parentSegment
				?.replace(/[\\/:*?"<>|]/g, " - ")
				.trim();

			// Build filesystem path
			const folderSegments = segments
				.slice(0, -1)
				.map((s) => s.replace(/[\\/:*?"<>|]/g, " - ").trim());
			const folderPath =
				folderSegments.length > 0
					? `${IMPORT_FOLDER}/${folderSegments.join("/")}`
					: basePath;

			// Ensure folder exists
			if (
				folderPath !== basePath &&
				!(await this.vault.exists(folderPath))
			) {
				await this.vault.ensureFolderRecursive(folderPath);
			}

			const notePath = `${folderPath}/${safeName}.md`;
			const cardIds = deckToCardIds.get(deckPath);
			const children = parentToChildren.get(deckPath);
			const isLeaf = !children || children.size === 0;

			const uid = await this.createOrUpdateNote(
				notePath,
				name,
				isLeaf ? undefined : children,
				safeParentName,
			);

			// Link cards to this note (only if this deck level has cards)
			if (cardIds) {
				for (const cardId of cardIds) {
					this.store.cards.updateCardSourceUid(cardId, uid);
				}
			}
		}
	}

	private async createOrUpdateNote(
		notePath: string,
		title: string,
		children?: Set<string>,
		parentName?: string,
	): Promise<string> {
		const fileExists = await this.vault.exists(notePath);

		if (fileExists) {
			const existingUid = await this.vault.getFrontmatterUid(notePath);

			if (existingUid) {
				if (children && children.size > 0) {
					await this.updateChildLinks(notePath, children);
				}
				if (parentName) {
					await this.vault.addParentToFrontmatter(notePath, parentName);
				}
				return existingUid;
			}

			// No UID: prepend frontmatter
			const uid = this.generateUid();
			const frontmatter = this.buildFrontmatter(uid, parentName);
			await this.vault.prependToFile(notePath, `${frontmatter}\n\n`);
			return uid;
		}

		const uid = this.generateUid();
		const frontmatter = this.buildFrontmatter(uid, parentName);

		const bodyParts = [`# ${title}`, ""];

		if (children && children.size > 0) {
			for (const child of [...children].sort()) {
				bodyParts.push(`- [[${child}]]`);
			}
			bodyParts.push("");
		} else {
			bodyParts.push("Imported from Anki.", "");
		}

		await this.vault.createFile(
			notePath,
			`${frontmatter}\n\n${bodyParts.join("\n")}`,
		);
		return uid;
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
