import type { App } from "obsidian";
import type {
	AnkiCard,
	AnkiImportOptions,
	AnkiImportResult,
	AnkiRevlogEntry,
	ConvertedCard,
	FSRSCardData,
} from "types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../core/fsrs.service";
import { generateUUID } from "../persistence/sqlite/sqlite.types";
import { getEventBus } from "../core/event-bus.service";
import { ApkgParserService } from "./apkg-parser.service";
import { AnkiConverterService } from "./anki-converter.service";
import { AnkiSchedulingService } from "./anki-scheduling.service";
import { AnkiMediaService } from "./anki-media.service";

export class AnkiImportService {
	constructor(
		private app: App,
		private store: SqliteStoreService,
		private fsrsService: FSRSService,
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
			projects: [],
		};

		// 1. Parse the .apkg file
		const parser = new ApkgParserService(this.app);
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
			const mediaService = new AnkiMediaService(this.app);
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
		const mediaService = new AnkiMediaService(this.app);

		// 7. Track unique projects from deck names
		const projectSet = new Set<string>();

		// 8. Process each converted card
		const importedCardIds: string[] = [];

		this.store.transaction(() => {
			// Track reversed card ID mapping: ankiCardId → TR cardId
			const ankiToTrCardId = new Map<number, string>();

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
					);

					if (importResult.status === "imported") {
						importedCardIds.push(importResult.cardId);
						result.imported++;
						projectSet.add(converted.deckName);
					} else if (importResult.status === "duplicate") {
						result.duplicates++;
					} else {
						result.skipped++;
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					result.errors.push(
						`Card ${converted.ankiCardId}: ${msg}`,
					);
					result.skipped++;
				}
			}

			// Insert review logs for imported cards (if scheduling enabled)
			if (options.importScheduling) {
				this.importReviewLogs(
					convertedCards,
					revlogByCard,
					importedCardIds,
					ankiToTrCardId,
				);
			}
		});

		result.projects = [...projectSet];

		// Flush to persist changes
		await this.store.flush();

		// Emit bulk-change event to refresh all views
		if (importedCardIds.length > 0) {
			getEventBus().emit({
				type: "cards:bulk-change",
				action: "added",
				cardIds: importedCardIds,
				timestamp: Date.now(),
			});
		}

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
	): { status: "imported"; cardId: string } | { status: "duplicate" | "skipped" } {
		// Check for duplicates by question content
		let question = converted.question;
		let answer = converted.answer;

		// Update media references if media was imported
		if (mediaPathMapping.size > 0) {
			question = mediaService.updateImportedContent(
				question,
				mediaPathMapping,
			);
			answer = mediaService.updateImportedContent(
				answer,
				mediaPathMapping,
			);
		}

		if (!question.trim()) {
			return { status: "skipped" };
		}

		// Check duplicate by exact question match
		const existingId = this.store.cards.getCardIdByQuestion(question);
		if (existingId) {
			// Map this anki card to the existing TR card for reversed linking
			ankiToTrCardId.set(converted.ankiCardId, existingId);
			return { status: "duplicate" };
		}

		// Generate new card ID
		const cardId = generateUUID();
		ankiToTrCardId.set(converted.ankiCardId, cardId);

		// Build FSRS card data
		let cardData: FSRSCardData;

		if (options.importScheduling) {
			const ankiCard = ankiCardMap.get(converted.ankiCardId) ?? this.buildMinimalAnkiCard(converted);
			const revlogs = revlogByCard.get(converted.ankiCardId) ?? [];
			cardData = schedulingService.convert(cardId, ankiCard, revlogs);
		} else {
			cardData = this.fsrsService.createNewCard(cardId);
		}

		// Set content fields
		cardData.question = question;
		cardData.answer = answer;
		cardData.cardType = converted.cardType;

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
			const originalTrId = ankiToTrCardId.get(
				converted.reverseOfAnkiCardId,
			);
			if (originalTrId) {
				cardData.reverseOf = originalTrId;
			}
		}

		// Save the card
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
				});
			}
		}
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
