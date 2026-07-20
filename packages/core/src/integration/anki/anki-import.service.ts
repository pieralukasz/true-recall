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
	ApkgData,
	ConvertedCard,
	FSRSCardData,
} from "@true-recall/core/types";

import { AnkiMediaService, type IVaultFileReader } from "./anki-media.service";
import { ApkgParserService } from "./apkg/apkg-parser.service";

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

export class AnkiImportService {
	constructor(
		private store: SqliteStoreService,
		private fsrsService: FSRSService,
		private persistence: IPersistence,
		private vault: IAnkiImportVault,
		private fileReader?: IVaultFileReader,
		private onCardChange?: CardChangeNotifier,
	) {}

	static async parseAndConvert(
		fileData: ArrayBuffer,
	): Promise<{ apkgData: ApkgData; convertedCards: ConvertedCard[] }> {
		const parser = new ApkgParserService();
		const apkgData = await parser.parseApkg(fileData);
		const converter = new AnkiConverterService();
		const convertedCards = converter.convert(apkgData);
		return { apkgData, convertedCards };
	}

	async importApkg(
		fileData: ArrayBuffer,
		options: AnkiImportOptions,
	): Promise<AnkiImportResult> {
		const { apkgData, convertedCards } =
			await AnkiImportService.parseAndConvert(fileData);
		return this.importCards(apkgData, convertedCards, options);
	}

	async importCards(
		apkgData: ApkgData,
		convertedCards: ConvertedCard[],
		options: AnkiImportOptions,
	): Promise<AnkiImportResult> {
		const result: AnkiImportResult = {
			imported: 0,
			skipped: 0,
			duplicates: 0,
			errors: [],
			noteTypesCreated: 0,
			fieldsDropped: 0,
		};

		if (convertedCards.length === 0) {
			result.errors.push("No cards found in the .apkg file");
			return result;
		}

		const mediaService = new AnkiMediaService(
			this.persistence,
			this.fileReader,
		);

		let mediaPathMapping = new Map<string, string>();
		if (options.importMedia && apkgData.media.size > 0) {
			mediaPathMapping = await mediaService.importMedia(
				apkgData.media,
				apkgData.mediaMap,
				options.mediaFolder,
			);
		}

		const replaceMediaPaths =
			mediaService.buildContentReplacer(mediaPathMapping);

		const revlogByCard = new Map<number, AnkiRevlogEntry[]>();
		for (const entry of apkgData.revlog) {
			const list = revlogByCard.get(entry.cid) ?? [];
			list.push(entry);
			revlogByCard.set(entry.cid, list);
		}

		const ankiCardMap = new Map<number, AnkiCard>();
		for (const card of apkgData.cards) {
			ankiCardMap.set(card.id, card);
		}

		const schedulingService = new AnkiSchedulingService(this.fsrsService);
		const noteTypeMapper = new AnkiNoteTypeMapper(this.store.noteTypes);

		const importedCardIds: string[] = [];
		const deckToCardIds = new Map<string, string[]>();

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
						replaceMediaPaths,
						options,
						ankiToTrCardId,
						noteTypeMapper,
						ankiNoteToTrNote,
					);

					if (importResult.status === "imported") {
						importedCardIds.push(importResult.cardId);
						result.imported++;
						result.fieldsDropped += importResult.fieldsDropped;

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

		// Inject ancestor deck paths so the full hierarchy is created
		for (const deckPath of [...deckToCardIds.keys()]) {
			const segments = deckPath.split("/");
			for (let i = 1; i < segments.length; i++) {
				const ancestorPath = segments.slice(0, i).join("/");
				if (!deckToCardIds.has(ancestorPath)) {
					deckToCardIds.set(ancestorPath, []);
				}
			}
		}

		if (deckToCardIds.size > 0) {
			try {
				await this.createDeckNotes(deckToCardIds, options.importFolder);
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
		replaceMediaPaths: (content: string) => string,
		options: AnkiImportOptions,
		ankiToTrCardId: Map<number, string>,
		noteTypeMapper: AnkiNoteTypeMapper,
		ankiNoteToTrNote: Map<number, string>,
	):
		| { status: "imported"; cardId: string; fieldsDropped: number }
		| { status: "duplicate" | "skipped" } {
		const question = replaceMediaPaths(converted.question);
		const answer = replaceMediaPaths(converted.answer);

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
		let fieldValues: Record<string, string> = {};
		for (const [key, value] of Object.entries(converted.fieldValues)) {
			fieldValues[key] = replaceMediaPaths(value);
		}

		// Apply field remapping if user specified one
		let fieldsDropped = 0;
		const mapping = options.modelMappings?.get(converted.ankiModelId);
		if (mapping?.fieldMapping && mapping.fieldMapping.size > 0) {
			const remap = remapFields(fieldValues, mapping.fieldMapping);
			fieldValues = remap.mapped;
			fieldsDropped = remap.dropped;
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
			const clozeTemplate = replaceMediaPaths(
				converted.clozeTemplate ?? question,
			);
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

		return { status: "imported", cardId, fieldsDropped };
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
					state: revlogTypeToFsrsState(entry.type),
					timeSpentMs: Math.max(0, entry.time),
					updatedAt: Date.now(),
					deletedAt: null,
					presetName: null,
				});
			}
		}
	}

	/**
	 * Creates one source note per deck.
	 * Leaf decks get cards linked; ancestor decks become MOC nodes in the hierarchy.
	 */
	private async createDeckNotes(
		deckToCardIds: Map<string, string[]>,
		importFolder: string,
	): Promise<void> {
		if (!(await this.vault.exists(importFolder))) {
			await this.vault.ensureFolderRecursive(importFolder);
		}

		// Sort by depth so parent folders are created first
		const sortedDecks = [...deckToCardIds.entries()].sort(
			(a, b) => a[0].split("/").length - b[0].split("/").length,
		);

		for (const [deckPath, cardIds] of sortedDecks) {
			const segments = deckPath.split("/");
			const name = segments[segments.length - 1] ?? "Default";
			const safeName = sanitize(name);

			// Build folder path (parent segments)
			const folderSegments = segments.slice(0, -1).map((s) => sanitize(s));
			const folderPath =
				folderSegments.length > 0
					? `${importFolder}/${folderSegments.join("/")}`
					: importFolder;

			if (!(await this.vault.exists(folderPath))) {
				await this.vault.ensureFolderRecursive(folderPath);
			}

			const notePath = `${folderPath}/${safeName}.md`;

			// Get or create the note
			const uid = await this.getOrCreateNote(notePath, name, segments);

			// Link all cards to this deck note
			for (const cardId of cardIds) {
				this.store.cards.updateCardSourceUid(cardId, uid);
			}
		}
	}

	private async getOrCreateNote(
		notePath: string,
		title: string,
		segments: string[],
	): Promise<string> {
		if (await this.vault.exists(notePath)) {
			const existingUid = await this.vault.getFrontmatterUid(notePath);
			if (existingUid) return existingUid;

			const uid = this.generateUid();
			const parentName =
				segments.length > 1
					? sanitize(segments[segments.length - 2] ?? "")
					: undefined;
			const frontmatter = this.buildFrontmatter(uid, parentName);
			await this.vault.prependToFile(notePath, `${frontmatter}\n\n`);
			return uid;
		}

		const uid = this.generateUid();
		const parentName =
			segments.length > 1
				? sanitize(segments[segments.length - 2] ?? "")
				: undefined;
		const frontmatter = this.buildFrontmatter(uid, parentName);

		await this.vault.createFile(
			notePath,
			`${frontmatter}\n\n# ${title}\n\nImported from Anki.\n`,
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

function remapFields(
	fields: Record<string, string>,
	mapping: Map<string, string>,
): { mapped: Record<string, string>; dropped: number } {
	const mapped: Record<string, string> = {};
	let dropped = 0;
	for (const [ankiField, value] of Object.entries(fields)) {
		const targetField = mapping.get(ankiField);
		if (targetField) {
			mapped[targetField] = value;
		} else {
			dropped++;
		}
	}
	return { mapped, dropped };
}

function sanitize(name: string): string {
	return (
		name
			.replace(/[\\/:*?"<>|]/g, " - ")
			.replace(/\s+/g, " ")
			.trim() || "Default"
	);
}

/**
 * Inverse of the export-side FSRS→revlog-type mapping. Anki revlog types:
 * 0=learn, 1=review, 2=relearn, 3=filtered, 4=manual — NOT aligned with
 * FSRS states (identity mapping stored every Anki "review" as Learning).
 */
function revlogTypeToFsrsState(type: number): number {
	switch (type) {
		case 1:
		case 3:
			// review / filtered-deck review
			return 2;
		case 2:
			return 3;
		default:
			// learn / manual / unknown
			return 1;
	}
}
