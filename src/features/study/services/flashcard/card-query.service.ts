import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type { SourceNoteService } from "@features/study/services/flashcard/source-note.service";
import type { CardType, FSRSCardData, FSRSFlashcardItem } from "@shared/types";

interface RawFlashcardItem {
	id: string;
	question: string;
	answer: string;
	fsrs: FSRSCardData;
	sourceUid?: string;
	cardType?: CardType;
	clozeTemplate?: string;
	clozeIndex?: number;
	reverseOf?: string;
	ioImagePath?: string;
	ioRegionsJson?: string;
	ioGroupKey?: string;
	ioParentId?: string;
}

export class CardQueryService {
	constructor(
		private store: SqliteStoreService,
		private sourceNoteService: SourceNoteService,
	) {}

	getAll(): FSRSFlashcardItem[] {
		const cardsWithContent = this.store.getCardsWithContent();

		const rawCards = this.filterAndMapCards(cardsWithContent);

		// Enrich with source note info from vault
		return this.sourceNoteService.enrichCards(rawCards);
	}

	getByIds(cardIds: string[]): FSRSFlashcardItem[] {
		if (cardIds.length === 0) return [];

		const cards = this.store.getByIds(cardIds);
		const rawCards = this.filterAndMapCards(cards);

		// Enrich with source note info from vault
		return this.sourceNoteService.enrichCards(rawCards);
	}

	getBySourceUid(sourceUid: string): FSRSFlashcardItem[] {
		const cards = this.store.getCardsBySourceUid(sourceUid);

		return cards
			.filter((card): card is FSRSCardData & { question: string } =>
				Boolean(card.question),
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer ?? "",
				fsrs: card,
				sourceUid: card.sourceUid,
				cardType: card.cardType,
				clozeTemplate: card.clozeTemplate,
				clozeIndex: card.clozeIndex,
				reverseOf: card.reverseOf,
				sourceText: card.sourceText,
				noteId: card.noteId,
				templateOrd: card.templateOrd,
				ioImagePath: card.ioImagePath,
				ioRegionsJson: card.ioRegionsJson,
				ioGroupKey: card.ioGroupKey,
				ioParentId: card.ioParentId,
			}));
	}

	getById(cardId: string): FSRSCardData | undefined {
		return this.store.get(cardId);
	}

	findByQuestion(question: string): string | undefined {
		return this.store.cards.getCardIdByQuestion(question);
	}

	count(): number {
		return this.store.getCardsWithContent().length;
	}

	private filterAndMapCards(cards: FSRSCardData[]): RawFlashcardItem[] {
		return cards
			.filter((card): card is FSRSCardData & { question: string } =>
				Boolean(card.question),
			)
			.map((card) => ({
				id: card.id,
				question: card.question,
				answer: card.answer ?? "",
				fsrs: card,
				sourceUid: card.sourceUid,
				cardType: card.cardType,
				clozeTemplate: card.clozeTemplate,
				clozeIndex: card.clozeIndex,
				reverseOf: card.reverseOf,
				noteId: card.noteId,
				templateOrd: card.templateOrd,
				ioImagePath: card.ioImagePath,
				ioRegionsJson: card.ioRegionsJson,
				ioGroupKey: card.ioGroupKey,
				ioParentId: card.ioParentId,
			}));
	}
}
