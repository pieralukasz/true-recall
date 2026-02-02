import type {
	FSRSCardData,
	FSRSFlashcardItem,
	CardReviewLogEntry,
	CardAddedEvent,
	CardRemovedEvent,
	CardUpdatedEvent,
} from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import { createDefaultFSRSData } from "../../types";
import { getEventBus } from "../core/event-bus.service";
import { CARD_HISTORY_LIMIT } from "../../constants";

export class CardRepository {
	constructor(private store: SqliteStoreService) {}

	/** @throws Error if card with same question already exists */
	create(
		question: string,
		answer: string,
		sourceUid?: string,
		sourceNoteName?: string
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
		};

		getEventBus().emit({
			type: "card:added",
			cardId,
			sourceNoteName,
			timestamp: Date.now(),
		} as CardAddedEvent);

		return card;
	}

	/** @throws Error if any card has a duplicate question */
	createBatch(
		flashcards: Array<{ id: string; question: string; answer: string }>,
		sourceUid: string,
		sourceNoteName?: string
	): FSRSFlashcardItem[] {
		// Check for duplicates before creating any cards
		const seenQuestions = new Set<string>();
		for (const flashcard of flashcards) {
			// Check for duplicate within batch
			if (seenQuestions.has(flashcard.question)) {
				throw new Error(
					`Duplicate question within batch: "${flashcard.question.slice(0, 50)}..."`
				);
			}
			seenQuestions.add(flashcard.question);

			// Check for existing card with same question
			const existingCardId = this.store.cards.getCardIdByQuestion(
				flashcard.question
			);
			if (existingCardId) {
				throw new Error(
					`A card with this question already exists: "${flashcard.question.slice(0, 50)}..."`
				);
			}
		}

		// All checks passed, create cards
		const createdCards: FSRSFlashcardItem[] = [];

		for (const flashcard of flashcards) {
			const fsrsData = createDefaultFSRSData(flashcard.id);

			const extendedData: FSRSCardData = {
				...fsrsData,
				question: flashcard.question,
				answer: flashcard.answer,
				sourceUid,
			};

			this.store.set(flashcard.id, extendedData);

			const card: FSRSFlashcardItem = {
				id: flashcard.id,
				question: flashcard.question,
				answer: flashcard.answer,
				fsrs: extendedData,
				projects: [],
				sourceNoteName,
				sourceUid,
			};

			createdCards.push(card);

			getEventBus().emit({
				type: "card:added",
				cardId: flashcard.id,
				sourceNoteName,
				timestamp: Date.now(),
			} as CardAddedEvent);
		}

		return createdCards;
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
			const history: CardReviewLogEntry[] =
				(existing?.history as CardReviewLogEntry[] | undefined) || [];
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

		// Soft delete card with cascade (also soft-deletes review_log)
		this.store.cards.softDeleteWithCascade(cardId);

		getEventBus().emit({
			type: "card:removed",
			cardId,
			timestamp: Date.now(),
		} as CardRemovedEvent);

		return true;
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
