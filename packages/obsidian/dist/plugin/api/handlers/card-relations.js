import { State } from "ts-fsrs";
import { sendError, sendOk } from "../api.types";
const STATE_LABELS = {
    [State.New]: "New",
    [State.Learning]: "Learning",
    [State.Review]: "Review",
    [State.Relearning]: "Relearning",
};
function mapCard(c) {
    var _a, _b, _c, _d, _e;
    return Object.assign(Object.assign(Object.assign({ id: c.id, question: (_a = c.question) !== null && _a !== void 0 ? _a : "", answer: (_b = c.answer) !== null && _b !== void 0 ? _b : "", cardType: (_c = c.cardType) !== null && _c !== void 0 ? _c : "basic", state: c.state, stateLabel: (_d = STATE_LABELS[c.state]) !== null && _d !== void 0 ? _d : "Unknown", stability: c.stability, difficulty: c.difficulty, reps: c.reps, lapses: c.lapses, due: c.due, sourceUid: c.sourceUid, sourceNoteName: (_e = c.sourceNoteName) !== null && _e !== void 0 ? _e : "" }, (c.reverseOf && { reverseOf: c.reverseOf })), (c.clozeIndex !== undefined && { clozeIndex: c.clozeIndex })), (c.noteTypeName && { noteTypeName: c.noteTypeName }));
}
export function handleGetCardRelations(_req, res, ctx, params) {
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const cardId = params.id;
    if (!cardId) {
        sendError(res, 400, "Missing card ID");
        return;
    }
    const card = ctx.plugin.cardStore.cards.get(cardId);
    if (!card) {
        sendError(res, 404, "Card not found");
        return;
    }
    const relations = {
        card: mapCard(card),
    };
    // Sibling cards from the same source note
    if (card.sourceUid) {
        const siblings = ctx.plugin.cardStore.cards
            .getCardsBySourceUid(card.sourceUid)
            .filter((c) => c.id !== cardId);
        relations.siblings = {
            count: siblings.length,
            cards: siblings.map(mapCard),
        };
    }
    else {
        relations.siblings = { count: 0, cards: [] };
    }
    // Reverse card pair
    if (card.reverseOf) {
        const original = ctx.plugin.cardStore.cards.get(card.reverseOf);
        if (original) {
            relations.reverseOf = mapCard(original);
        }
    }
    // Find cards that are reverse of this card
    if (card.cardType === "basic") {
        const allCards = card.sourceUid
            ? ctx.plugin.cardStore.cards.getCardsBySourceUid(card.sourceUid)
            : [];
        const reverseCards = allCards.filter((c) => c.reverseOf === cardId);
        if (reverseCards.length > 0) {
            relations.reversedBy = reverseCards.map(mapCard);
        }
    }
    // Cloze siblings (same template, different deletions)
    if (card.cardType === "cloze" && card.sourceUid && card.clozeTemplate) {
        const clozeSiblings = ctx.plugin.cardStore
            .getClozeSiblings(card.sourceUid, card.clozeTemplate)
            .filter((c) => c.id !== cardId);
        if (clozeSiblings.length > 0) {
            relations.clozeSiblings = {
                count: clozeSiblings.length,
                cards: clozeSiblings.map(mapCard),
            };
        }
    }
    sendOk(res, relations);
}
