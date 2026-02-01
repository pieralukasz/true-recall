/**
 * Card Query Service
 * Handles read-only query operations for flashcards
 * Extracted from FlashcardManager for single responsibility
 */
import type { FSRSCardData, FSRSFlashcardItem } from "../../types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { SourceNoteService } from "./source-note.service";

/**
 * Minimal card data before enrichment with source note info
 */
interface RawFlashcardItem {
	id: string;
	question: string;
	answer: string;
	fsrs: FSRSCardData;
	sourceUid?: string;
}

/**
 * Service for querying flashcards from storage
 * Does not mutate data - use CardRepository for mutations
 */
export class CardQueryService {
	constructor(
		private store: SqliteStoreService,
		private sourceNoteService: SourceNoteService
	) {}

	/**
	 * Get all flashcards, enriched with source note info
	 * @returns All active (non-deleted) cards with sourceNoteName, sourceNotePath, projects
	 */
	getAll(): FSRSFlashcardItem[] {
		const cardsWithContent = this.store.getCardsWithContent();

		const rawCards = this.filterAndMapCards(cardsWithContent);

		// Enrich with source note info from vault
		return this.sourceNoteService.enrichCards(rawCards);
	}

	/**
	 * Get specific flashcards by IDs (optimized batch fetch)
	 * Uses SQL WHERE IN instead of fetching all cards
	 */
	getByIds(cardIds: string[]): FSRSFlashcardItem[] {
		if (cardIds.length === 0) return [];

		const cards = this.store.getByIds(cardIds);
		const rawCards = this.filterAndMapCards(cards);

		// Enrich with source note info from vault
		return this.sourceNoteService.enrichCards(rawCards);
	}

	/**
	 * Get flashcards by source note UID
	 * @param sourceUid - The flashcard_uid from the source note's frontmatter
	 */
	getBySourceUid(sourceUid: string): FSRSFlashcardItem[] {
		const cards = this.store.getCardsBySourceUid(sourceUid);

		return cards
			.filter((card): card is FSRSCardData & { question: string } =>
				Boolean(card.question)
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer ?? "",
				fsrs: card,
				projects: card.projects || [],
				sourceUid: card.sourceUid,
			}));
	}

	/**
	 * Get all orphaned cards (cards without source_uid or with deleted source notes)
	 */
	getOrphaned(): FSRSFlashcardItem[] {
		const cards = this.store.getOrphanedCards();

		return cards
			.filter((card): card is FSRSCardData & { question: string } =>
				Boolean(card.question)
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer ?? "",
				fsrs: card,
				projects: card.projects || [],
				sourceUid: undefined,
			}));
	}

	/**
	 * Get a single card by ID (raw, without enrichment)
	 */
	getById(cardId: string): FSRSCardData | undefined {
		return this.store.get(cardId);
	}

	/**
	 * Check if a card with given question already exists
	 * @returns Card ID if exists, undefined otherwise
	 */
	findByQuestion(question: string): string | undefined {
		return this.store.cards.getCardIdByQuestion(question);
	}

	/**
	 * Count all active cards
	 */
	count(): number {
		return this.store.getCardsWithContent().length;
	}

	/**
	 * Filter cards with questions and map to raw format
	 */
	private filterAndMapCards(cards: FSRSCardData[]): RawFlashcardItem[] {
		return cards
			.filter((card): card is FSRSCardData & { question: string } =>
				Boolean(card.question)
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer ?? "",
				fsrs: card,
				sourceUid: card.sourceUid,
			}));
	}
}
