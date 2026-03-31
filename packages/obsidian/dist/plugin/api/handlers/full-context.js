import { __awaiter } from "tslib";
import { VIEW_TYPE_CARD_BROWSER, VIEW_TYPE_DASHBOARD, VIEW_TYPE_FLASHCARD_PANEL, VIEW_TYPE_REVIEW, VIEW_TYPE_SIMULATOR, VIEW_TYPE_STATS, } from "@true-recall/core/constants";
import { State } from "ts-fsrs";
import { sendOk } from "../api.types";
const STATE_LABELS = {
    [State.New]: "New",
    [State.Learning]: "Learning",
    [State.Review]: "Review",
    [State.Relearning]: "Relearning",
};
const VIEW_LABELS = {
    [VIEW_TYPE_REVIEW]: "review",
    [VIEW_TYPE_FLASHCARD_PANEL]: "flashcard-panel",
    [VIEW_TYPE_CARD_BROWSER]: "card-browser",
    [VIEW_TYPE_DASHBOARD]: "dashboard",
    [VIEW_TYPE_STATS]: "statistics",
    [VIEW_TYPE_SIMULATOR]: "simulator",
    markdown: "note-editor",
    empty: "empty",
};
export function handleGetFullContext(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const result = {
            vault: ctx.plugin.app.vault.getName(),
            dbReady: ctx.plugin.isStoreReady(),
        };
        // Active view
        const activeFile = ctx.plugin.app.workspace.getActiveFile();
        const activeLf = ctx.plugin.app.workspace.getMostRecentLeaf();
        const viewType = (_b = (_a = activeLf === null || activeLf === void 0 ? void 0 : activeLf.view) === null || _a === void 0 ? void 0 : _a.getViewType()) !== null && _b !== void 0 ? _b : "unknown";
        result.activeView = (_c = VIEW_LABELS[viewType]) !== null && _c !== void 0 ? _c : viewType;
        // Active note
        const file = ctx.plugin.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
            const noteInfo = {
                path: file.path,
                basename: file.basename,
            };
            if (ctx.plugin.isStoreReady()) {
                const frontmatterService = ctx.plugin.flashcardManager.getFrontmatterService();
                const sourceUid = (_d = (yield frontmatterService.getSourceNoteUid(file.path))) !== null && _d !== void 0 ? _d : undefined;
                if (sourceUid) {
                    const cards = ctx.plugin.cardStore.cards.getCardsBySourceUid(sourceUid);
                    noteInfo.sourceUid = sourceUid;
                    noteInfo.cardCount = cards.length;
                    noteInfo.cardStates = {
                        new: cards.filter((c) => c.state === State.New).length,
                        learning: cards.filter((c) => c.state === State.Learning || c.state === State.Relearning).length,
                        review: cards.filter((c) => c.state === State.Review).length,
                    };
                }
                else {
                    noteInfo.cardCount = 0;
                }
            }
            result.activeNote = noteInfo;
        }
        else {
            result.activeNote = null;
        }
        // Review session
        if (ctx.plugin.store) {
            const review = ctx.plugin.store.getState().review;
            const phase = review.getPhase();
            if (phase.type === "idle") {
                result.reviewSession = { active: false, phase: "idle" };
            }
            else if (phase.type === "complete") {
                result.reviewSession = {
                    active: false,
                    phase: "complete",
                    stats: review.getStats(),
                };
            }
            else if (phase.type === "waiting") {
                result.reviewSession = {
                    active: true,
                    phase: "waiting",
                    timeUntilDue: phase.timeUntilDue,
                    progress: review.getProgress(),
                    badgeCounts: review.getBadgeCounts(),
                };
            }
            else {
                const card = phase.card;
                result.reviewSession = {
                    active: true,
                    phase: "active",
                    currentCard: {
                        id: card.id,
                        question: card.question,
                        answer: card.answer,
                        cardType: (_e = card.cardType) !== null && _e !== void 0 ? _e : "basic",
                        state: card.fsrs.state,
                        stateLabel: (_f = STATE_LABELS[card.fsrs.state]) !== null && _f !== void 0 ? _f : "Unknown",
                        sourceNoteName: (_g = card.sourceNoteName) !== null && _g !== void 0 ? _g : "",
                        sourceUid: (_h = card.sourceUid) !== null && _h !== void 0 ? _h : "",
                    },
                    isAnswerRevealed: review.isAnswerShown(),
                    progress: review.getProgress(),
                    badgeCounts: review.getBadgeCounts(),
                };
            }
        }
        else {
            result.reviewSession = { active: false, phase: "idle" };
        }
        // Today's study summary (lightweight)
        if (ctx.plugin.isStoreReady()) {
            const { formatLocalDate } = yield import("@true-recall/core/utils");
            const today = formatLocalDate(new Date());
            const dailyStats = ctx.plugin.cardStore.stats.getDailyStats(today);
            if (dailyStats && dailyStats.reviewsCompleted > 0) {
                result.todayStudy = {
                    reviewsCompleted: dailyStats.reviewsCompleted,
                    newCardsStudied: dailyStats.newCardsStudied,
                    totalTimeMs: dailyStats.totalTimeMs,
                    ratings: {
                        again: dailyStats.again,
                        hard: dailyStats.hard,
                        good: dailyStats.good,
                        easy: dailyStats.easy,
                    },
                };
            }
            else {
                result.todayStudy = null;
            }
            // Due cards count
            const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();
            let allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
            if (archivedUids.size > 0) {
                allCards = allCards.filter((c) => !c.sourceUid || !archivedUids.has(c.sourceUid));
            }
            const dueCards = ctx.plugin.dayBoundaryService.getDueCards(allCards);
            result.dueCount = dueCards.length;
        }
        sendOk(res, result);
    });
}
