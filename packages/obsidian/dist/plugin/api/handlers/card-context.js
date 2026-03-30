import { __awaiter } from "tslib";
import { TFile } from "obsidian";
import { State } from "ts-fsrs";
import { sendError, sendOk } from "../api.types";
const STATE_LABELS = {
    [State.New]: "New",
    [State.Learning]: "Learning",
    [State.Review]: "Review",
    [State.Relearning]: "Relearning",
};
export function handleGetCardContext(_req, res, ctx, params) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
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
        const history = ctx.plugin.cardStore.stats.getCardReviewHistory(cardId, 20);
        const result = {
            card: Object.assign(Object.assign(Object.assign({ id: card.id, question: (_a = card.question) !== null && _a !== void 0 ? _a : "", answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "", cardType: (_c = card.cardType) !== null && _c !== void 0 ? _c : "basic", state: card.state, stateLabel: (_d = STATE_LABELS[card.state]) !== null && _d !== void 0 ? _d : "Unknown", due: card.due, stability: card.stability, difficulty: card.difficulty, reps: card.reps, lapses: card.lapses, lastReview: card.lastReview, sourceUid: card.sourceUid, sourceNoteName: (_e = card.sourceNoteName) !== null && _e !== void 0 ? _e : "", sourceNotePath: (_f = card.sourceNotePath) !== null && _f !== void 0 ? _f : "", noteTypeName: card.noteTypeName }, (card.sourceText && { sourceText: card.sourceText })), (card.cardType === "cloze" && {
                clozeTemplate: card.clozeTemplate,
                clozeIndex: card.clozeIndex,
            })), (card.reverseOf && { reverseOf: card.reverseOf })),
            reviewHistory: history,
        };
        // Source note content
        if (card.sourceNotePath) {
            const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(card.sourceNotePath);
            if (abstractFile instanceof TFile) {
                try {
                    const content = yield ctx.plugin.app.vault.read(abstractFile);
                    result.sourceNote = {
                        path: abstractFile.path,
                        basename: abstractFile.basename,
                        content,
                    };
                }
                catch (_g) {
                    // File read failed — omit
                }
            }
        }
        // Sibling cards from the same source note
        if (card.sourceUid) {
            const siblings = ctx.plugin.cardStore.cards
                .getCardsBySourceUid(card.sourceUid)
                .filter((c) => c.id !== cardId)
                .map((c) => {
                var _a, _b, _c, _d;
                return ({
                    id: c.id,
                    question: (_a = c.question) !== null && _a !== void 0 ? _a : "",
                    answer: (_b = c.answer) !== null && _b !== void 0 ? _b : "",
                    cardType: (_c = c.cardType) !== null && _c !== void 0 ? _c : "basic",
                    state: c.state,
                    stateLabel: (_d = STATE_LABELS[c.state]) !== null && _d !== void 0 ? _d : "Unknown",
                    stability: c.stability,
                    difficulty: c.difficulty,
                    reps: c.reps,
                    lapses: c.lapses,
                });
            });
            result.siblings = { count: siblings.length, cards: siblings };
        }
        else {
            result.siblings = { count: 0, cards: [] };
        }
        sendOk(res, result);
    });
}
