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
export function handleGetReviewContext(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        if (!ctx.plugin.store) {
            sendError(res, 503, "Store not ready");
            return;
        }
        const review = ctx.plugin.store.getState().review;
        const phase = review.getPhase();
        if (phase.type === "idle") {
            sendOk(res, { active: false, phase: "idle" });
            return;
        }
        if (phase.type === "complete") {
            sendOk(res, {
                active: false,
                phase: "complete",
                stats: review.getStats(),
            });
            return;
        }
        const progress = review.getProgress();
        const badgeCounts = review.getBadgeCounts();
        const stats = review.getStats();
        const isAnswerRevealed = review.isAnswerShown();
        if (phase.type === "waiting") {
            sendOk(res, {
                active: true,
                phase: "waiting",
                timeUntilDue: phase.timeUntilDue,
                progress,
                badgeCounts,
                stats,
                isAnswerRevealed,
            });
            return;
        }
        const card = phase.card;
        const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://localhost");
        const includeNoteContent = url.searchParams.get("include_note_content") === "true";
        const response = {
            active: true,
            phase: "active",
            card: Object.assign(Object.assign(Object.assign({ id: card.id, question: card.question, answer: card.answer, cardType: (_b = card.cardType) !== null && _b !== void 0 ? _b : "basic", state: card.fsrs.state, stateLabel: (_c = STATE_LABELS[card.fsrs.state]) !== null && _c !== void 0 ? _c : "Unknown", due: card.fsrs.due, reps: card.fsrs.reps, lapses: card.fsrs.lapses, stability: card.fsrs.stability, difficulty: card.fsrs.difficulty, sourceNoteName: (_d = card.sourceNoteName) !== null && _d !== void 0 ? _d : "", sourceNotePath: (_e = card.sourceNotePath) !== null && _e !== void 0 ? _e : "", sourceUid: (_f = card.sourceUid) !== null && _f !== void 0 ? _f : "" }, (card.sourceText && { sourceText: card.sourceText })), (card.noteTypeName && { noteTypeName: card.noteTypeName })), (card.cardType === "cloze" && {
                clozeTemplate: card.clozeTemplate,
                clozeIndex: card.clozeIndex,
            })),
            isAnswerRevealed,
            progress,
            badgeCounts,
            stats: {
                total: stats.total,
                reviewed: stats.reviewed,
                again: stats.again,
                hard: stats.hard,
                good: stats.good,
                easy: stats.easy,
                duration: stats.duration,
            },
        };
        if (includeNoteContent && card.sourceNotePath) {
            const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(card.sourceNotePath);
            if (abstractFile instanceof TFile) {
                try {
                    const content = yield ctx.plugin.app.vault.read(abstractFile);
                    response.sourceNote = {
                        path: abstractFile.path,
                        basename: abstractFile.basename,
                        content,
                    };
                }
                catch (_g) {
                    // File read failed — omit sourceNote silently
                }
            }
        }
        sendOk(res, response);
    });
}
