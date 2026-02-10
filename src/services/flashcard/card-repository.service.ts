import type {
	FSRSCardData,
	FSRSFlashcardItem,
	CardReviewLogEntry,
	CardAddedEvent,
	CardRemovedEvent,
	CardUpdatedEvent,
	BulkChangeEvent,
	CardType,
} from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { createDefaultFSRSData } from "../../types";
import { getEventBus } from "../core/event-bus.service";
import { CARD_HISTORY_LIMIT } from "../../constants";

export interface DuplicateInfo {
	flashcard: { id: string; question: string; answer: string };
	type: "batch" | "existing";
	existingCardId?: string;
}

export interface CreateBatchResult {
	created: FSRSFlashcardItem[];
	duplicates: DuplicateInfo[];
}

export class CardRepository {
	constructor(private store: SqliteStoreService) {}

	/** @throws Error if card with same question already exists */
	create(
		question: string,
		answer: string,
		sourceUid?: string,
		sourceNoteName?: string,
		options?: { cardType?: CardType; clozeTemplate?: string; clozeIndex?: number; reverseOf?: string }
	): FSRSFlashcardItem {
		// Check for duplicate question
		const existingCardId = this.store.cards.getCardIdByQuestion(question);
		if (existingCardId) {
			throw new Error("A card with this question already exists");
		}

		const cardId = crypto.randomUUID();
		const fsrsData = createDefaultFSRSData(cardId);

		const extendedData: FSRSCardData = {
			...fsrsData,
			question,
			answer,
			sourceUid,
			cardType: options?.cardType,
			clozeTemplate: options?.clozeTemplate,
			clozeIndex: options?.clozeIndex,
			reverseOf: options?.reverseOf,
		};

		this.store.set(cardId, extendedData);

		const card: FSRSFlashcardItem = {
			id: cardId,
			question,
			answer,
			fsrs: extendedData,
			projects: [],
			sourceUid,
			sourceNoteName,
			cardType: options?.cardType,
			clozeTemplate: options?.clozeTemplate,
			clozeIndex: options?.clozeIndex,
			reverseOf: options?.reverseOf,
		};

		getEventBus().emit({
			type: "card:added",
			cardId,
			sourceNoteName,
			timestamp: Date.now(),
		} as CardAddedEvent);

		return card;
	}

	createBatch(
		flashcards: Array<{
			id: string;
			question: string;
			answer: string;
			cardType?: CardType;
			clozeTemplate?: string;
			clozeIndex?: number;
			reverseOfBatchId?: string;
		}>,
		sourceUid: string,
		sourceNoteName?: string
	): CreateBatchResult {
		const createdCards: FSRSFlashcardItem[] = [];
		const duplicates: DuplicateInfo[] = [];
		const seenQuestions = new Set<string>();
		// Map batch-level IDs to actual DB IDs for reverse pairing
		const batchIdToDbId = new Map<string, string>();

		for (const flashcard of flashcards) {
			// Check for duplicate within batch
			if (seenQuestions.has(flashcard.question)) {
				duplicates.push({
					flashcard,
					type: "batch",
				});
				continue;
			}

			// Cloze-specific duplicate check
			if (flashcard.cardType === "cloze" && flashcard.clozeTemplate && flashcard.clozeIndex !== undefined) {
				const existingCloze = this.store.cards.findClozeCard(
					sourceUid, flashcard.clozeTemplate, flashcard.clozeIndex
				);
				if (existingCloze) {
					duplicates.push({
						flashcard,
						type: "existing",
						existingCardId: existingCloze,
					});
					continue;
				}
			}

			// Check for existing card with same question
			const existingCardId = this.store.cards.getCardIdByQuestion(
				flashcard.question
			);
			if (existingCardId) {
				duplicates.push({
					flashcard,
					type: "existing",
					existingCardId,
				});
				continue;
			}

			// Mark question as seen and create the card
			seenQuestions.add(flashcard.question);

			const fsrsData = createDefaultFSRSData(flashcard.id);

			// Resolve reverse_of: if this card references a batch ID, look up the real DB ID
			let reverseOf: string | undefined;
			if (flashcard.reverseOfBatchId) {
				reverseOf = batchIdToDbId.get(flashcard.reverseOfBatchId);
			}

			const extendedData: FSRSCardData = {
				...fsrsData,
				question: flashcard.question,
				answer: flashcard.answer,
				sourceUid,
				cardType: flashcard.cardType,
				clozeTemplate: flashcard.clozeTemplate,
				clozeIndex: flashcard.clozeIndex,
				reverseOf,
			};

			this.store.set(flashcard.id, extendedData);

			// Track this card's batch ID -> DB ID mapping
			batchIdToDbId.set(flashcard.id, flashcard.id);

			const card: FSRSFlashcardItem = {
				id: flashcard.id,
				question: flashcard.question,
				answer: flashcard.answer,
				fsrs: extendedData,
				projects: [],
				sourceNoteName,
				sourceUid,
				cardType: flashcard.cardType,
				clozeTemplate: flashcard.clozeTemplate,
				clozeIndex: flashcard.clozeIndex,
				reverseOf,
			};

			createdCards.push(card);

			getEventBus().emit({
				type: "card:added",
				cardId: flashcard.id,
				sourceNoteName,
				timestamp: Date.now(),
			} as CardAddedEvent);
		}

		return { created: createdCards, duplicates };
	}

	get(cardId: string): FSRSCardData | undefined {
		return this.store.get(cardId);
	}

	has(cardId: string): boolean {
		return this.store.has(cardId);
	}

	/** @throws Error if card not found */
	updateContent(cardId: string, newQuestion: string, newAnswer: string): void {
		const existing = this.store.get(cardId);
		if (!existing) {
			throw new Error(`Card ${cardId} not found`);
		}

		const updated: FSRSCardData = {
			...existing,
			question: newQuestion,
			answer: newAnswer,
		};

		this.store.set(cardId, updated);

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes: { question: true, answer: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);

		// Sync reversed pair: update the paired card with swapped Q/A
		this.syncReversePair(cardId, existing, newQuestion, newAnswer);
	}

	private syncReversePair(
		cardId: string,
		cardData: FSRSCardData,
		newQuestion: string,
		newAnswer: string
	): void {
		// Case 1: This card IS a reverse - update the original
		if (cardData.reverseOf) {
			const original = this.store.get(cardData.reverseOf);
			if (original) {
				this.store.cards.updateCardContent(cardData.reverseOf, newAnswer, newQuestion);
				getEventBus().emit({
					type: "card:updated",
					cardId: cardData.reverseOf,
					changes: { question: true, answer: true },
					timestamp: Date.now(),
				} as CardUpdatedEvent);
			}
		}

		// Case 2: This card HAS a reverse - update the reverse
		const reverseCard = this.store.cards.getCardByReverseOf(cardId);
		if (reverseCard) {
			this.store.cards.updateCardContent(reverseCard.id, newAnswer, newQuestion);
			getEventBus().emit({
				type: "card:updated",
				cardId: reverseCard.id,
				changes: { question: true, answer: true },
				timestamp: Date.now(),
			} as CardUpdatedEvent);
		}
	}

	updateFSRS(
		cardId: string,
		newFSRSData: FSRSCardData,
		reviewLogEntry?: CardReviewLogEntry
	): void {
		const existing = this.store.get(cardId);
		const entry: FSRSCardData = { ...newFSRSData };

		// Append review to history if provided
		if (reviewLogEntry) {
			const history: CardReviewLogEntry[] = existing?.history ?? [];
			history.push(reviewLogEntry);
			// Keep only last N entries
			entry.history =
				history.length > CARD_HISTORY_LIMIT
					? history.slice(-CARD_HISTORY_LIMIT)
					: history;
		} else if (existing?.history) {
			entry.history = existing.history;
		}

		// Preserve question/answer if not in newFSRSData
		if (existing?.question && !entry.question) {
			entry.question = existing.question;
		}
		if (existing?.answer && !entry.answer) {
			entry.answer = existing.answer;
		}
		if (existing?.sourceUid && !entry.sourceUid) {
			entry.sourceUid = existing.sourceUid;
		}

		this.store.set(cardId, entry);

		// Detect specific changes for more targeted UI updates
		const changes: CardUpdatedEvent["changes"] = { fsrs: true };
		if (existing && newFSRSData.suspended !== existing.suspended) {
			changes.suspended = true;
		}
		if (existing && newFSRSData.buriedUntil !== existing.buriedUntil) {
			changes.buried = true;
		}

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes,
			timestamp: Date.now(),
		} as CardUpdatedEvent);
	}

	updateSourceUid(cardId: string, newSourceUid: string): boolean {
		const existing = this.store.get(cardId);
		if (!existing) {
			return false;
		}

		this.store.cards.updateCardSourceUid(cardId, newSourceUid);

		getEventBus().emit({
			type: "card:updated",
			cardId,
			changes: { sourceUid: true },
			timestamp: Date.now(),
		} as CardUpdatedEvent);

		return true;
	}

	delete(cardId: string): boolean {
		const card = this.store.get(cardId);
		if (!card) {
			return false;
		}

		// If this is an original card with a reverse, cascade-delete the reverse
		if (!card.reverseOf) {
			const reverseCard = this.store.cards.getCardByReverseOf(cardId);
			if (reverseCard) {
				this.store.cards.softDeleteWithCascade(reverseCard.id);
				getEventBus().emit({
					type: "card:removed",
					cardId: reverseCard.id,
					timestamp: Date.now(),
				} as CardRemovedEvent);
			}
		}

		// Soft delete card with cascade (also soft-deletes review_log)
		this.store.cards.softDeleteWithCascade(cardId);

		getEventBus().emit({
			type: "card:removed",
			cardId,
			timestamp: Date.now(),
		} as CardRemovedEvent);

		return true;
	}

	deleteBatch(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;

		// Single SQL transaction instead of N individual deletes
		const count = this.store.cards.bulkSoftDelete(cardIds);

		getEventBus().emit({
			type: "cards:bulk-change",
			action: "removed",
			cardIds,
			timestamp: Date.now(),
		} as BulkChangeEvent);

		return count;
	}

	/** Returns true if card was saved, false if skipped (already exists) */
	setIfNotExists(cardId: string, fsrsData: FSRSCardData): boolean {
		// Only set if not already exists (prevent overwriting existing data)
		const existing = this.store.get(cardId);
		if (existing) {
			console.debug(`[CardRepository] Card ${cardId} already exists, skipping`);
			return false;
		}

		this.store.set(cardId, fsrsData);
		return true;
	}
}
