import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type {
	CardSchedulingMeta,
	CardType,
	FSRSCardData,
	FSRSFlashcardItem,
} from "../types";
import type { SourceNoteService } from "./source-note.service";

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
	noteTypeName?: string;
	alwaysTypeIn?: boolean;
}

export class CardQueryService {
	constructor(
		private store: SqliteStoreService,
		private sourceNoteService: SourceNoteService,
	) {}

	// ── Tier 1: Scheduling metadata (fast, no template rendering) ────

	getAllMeta(): CardSchedulingMeta[] {
		const metas = this.store.getAllSchedulingMeta();
		return this.sourceNoteService.enrichMetas(metas);
	}

	getMetaById(cardId: string): CardSchedulingMeta | null {
		const meta = this.store.getSchedulingMetaById(cardId);
		if (!meta) return null;
		return this.sourceNoteService.enrichMeta(meta);
	}

	// ── Tier 2: Full content (with template rendering, per card) ─────

	getContent(cardId: string): FSRSFlashcardItem | null {
		const card = this.store.get(cardId);
		if (!card || !card.question) return null;
		const item: FSRSFlashcardItem = {
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
			noteTypeName: card.noteTypeName,
			ioImagePath: card.ioImagePath,
			ioRegionsJson: card.ioRegionsJson,
			ioGroupKey: card.ioGroupKey,
			ioParentId: card.ioParentId,
			alwaysTypeIn: card.alwaysTypeIn,
		};
		return this.sourceNoteService.enrichCard(item);
	}

	// ── Legacy API (full content for all cards) ──────────────────────

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
				noteTypeName: card.noteTypeName,
				ioImagePath: card.ioImagePath,
				ioRegionsJson: card.ioRegionsJson,
				ioGroupKey: card.ioGroupKey,
				ioParentId: card.ioParentId,
				alwaysTypeIn: card.alwaysTypeIn,
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
				noteTypeName: card.noteTypeName,
				ioImagePath: card.ioImagePath,
				ioRegionsJson: card.ioRegionsJson,
				ioGroupKey: card.ioGroupKey,
				ioParentId: card.ioParentId,
				alwaysTypeIn: card.alwaysTypeIn,
			}));
	}
}
