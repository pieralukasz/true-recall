export function hasDisplayableContent(card) {
    return Boolean(card.question) || card.cardType === "note-review";
}
export class CardQueryService {
    constructor(store, sourceNoteService) {
        this.store = store;
        this.sourceNoteService = sourceNoteService;
    }
    // ── Tier 1: Scheduling metadata (fast, no template rendering) ────
    getAllMeta() {
        const metas = this.store.getAllSchedulingMeta();
        return this.sourceNoteService.enrichMetas(metas);
    }
    getMetaById(cardId) {
        const meta = this.store.getSchedulingMetaById(cardId);
        if (!meta)
            return null;
        return this.sourceNoteService.enrichMeta(meta);
    }
    // ── Tier 2: Full content (with template rendering, per card) ─────
    getContent(cardId) {
        var _a, _b;
        const card = this.store.get(cardId);
        if (!card)
            return null;
        if (!hasDisplayableContent(card))
            return null;
        const item = {
            id: card.id,
            question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
            answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
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
    getAll() {
        const cardsWithContent = this.store.getCardsWithContent();
        const rawCards = this.filterAndMapCards(cardsWithContent);
        // Enrich with source note info from vault
        return this.sourceNoteService.enrichCards(rawCards);
    }
    getByIds(cardIds) {
        if (cardIds.length === 0)
            return [];
        const cards = this.store.getByIds(cardIds);
        const rawCards = this.filterAndMapCards(cards);
        const enriched = this.sourceNoteService.enrichCards(rawCards);
        // SQL IN() returns rows in arbitrary order — restore caller's order
        const byId = new Map(enriched.map((c) => [c.id, c]));
        const ordered = [];
        for (const id of cardIds) {
            const card = byId.get(id);
            if (card)
                ordered.push(card);
        }
        return ordered;
    }
    getBySourceUid(sourceUid) {
        const cards = this.store.getCardsBySourceUid(sourceUid);
        return cards
            .filter((card) => hasDisplayableContent(card))
            .map((card) => {
            var _a, _b;
            return ({
                id: card.id,
                question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
                answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
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
            });
        });
    }
    getById(cardId) {
        return this.store.get(cardId);
    }
    findByQuestion(question) {
        return this.store.cards.getCardIdByQuestion(question);
    }
    count() {
        return this.store.getCardsWithContent().length;
    }
    filterAndMapCards(cards) {
        return cards
            .filter((card) => hasDisplayableContent(card))
            .map((card) => {
            var _a, _b;
            return ({
                id: card.id,
                question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
                answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
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
            });
        });
    }
}
