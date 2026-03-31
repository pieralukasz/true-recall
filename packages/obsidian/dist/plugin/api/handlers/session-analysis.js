import { formatLocalDate } from "@true-recall/core/utils";
import { State } from "ts-fsrs";
import { sendError, sendOk } from "../api.types";
const STATE_LABELS = {
    [State.New]: "New",
    [State.Learning]: "Learning",
    [State.Review]: "Review",
    [State.Relearning]: "Relearning",
};
export function handleGetSessionAnalysis(_req, res, ctx) {
    var _a;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const today = formatLocalDate(new Date());
    const dailyStats = ctx.plugin.cardStore.stats.getDailyStats(today);
    if (!dailyStats || dailyStats.reviewsCompleted === 0) {
        sendOk(res, {
            date: today,
            hasData: false,
            message: "No reviews completed today yet.",
        });
        return;
    }
    const reviewedCardIds = (_a = dailyStats.reviewedCardIds) !== null && _a !== void 0 ? _a : [];
    const cards = reviewedCardIds
        .map((id) => {
        var _a, _b, _c, _d, _e;
        const card = ctx.plugin.cardStore.cards.get(id);
        if (!card)
            return null;
        const history = ctx.plugin.cardStore.stats.getCardReviewHistory(id, 5);
        const todayReviews = history.filter((h) => {
            const reviewDate = formatLocalDate(new Date(h.t));
            return reviewDate === today;
        });
        return {
            id: card.id,
            question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
            answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
            cardType: (_c = card.cardType) !== null && _c !== void 0 ? _c : "basic",
            state: card.state,
            stateLabel: (_d = STATE_LABELS[card.state]) !== null && _d !== void 0 ? _d : "Unknown",
            stability: card.stability,
            difficulty: card.difficulty,
            reps: card.reps,
            lapses: card.lapses,
            sourceUid: card.sourceUid,
            sourceNoteName: (_e = card.sourceNoteName) !== null && _e !== void 0 ? _e : "",
            noteTypeName: card.noteTypeName,
            todayRatings: todayReviews.map((r) => r.r),
        };
    })
        .filter(Boolean);
    // Group by source note
    const byNote = new Map();
    for (const card of cards) {
        if (!card)
            continue;
        const name = card.sourceNoteName || "(orphaned)";
        const existing = byNote.get(name);
        if (existing) {
            existing.count++;
        }
        else {
            byNote.set(name, { count: 1, sourceUid: card.sourceUid });
        }
    }
    const noteBreakdown = [...byNote.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, info]) => ({
        note: name,
        count: info.count,
        sourceUid: info.sourceUid,
    }));
    // Cards that got "Again" today (struggled)
    const struggled = cards.filter((c) => c === null || c === void 0 ? void 0 : c.todayRatings.includes(1));
    sendOk(res, {
        date: today,
        hasData: true,
        summary: {
            reviewsCompleted: dailyStats.reviewsCompleted,
            newCardsStudied: dailyStats.newCardsStudied,
            totalTimeMs: dailyStats.totalTimeMs,
            ratings: {
                again: dailyStats.again,
                hard: dailyStats.hard,
                good: dailyStats.good,
                easy: dailyStats.easy,
            },
            retentionRate: dailyStats.reviewsCompleted > 0
                ? Math.round(((dailyStats.reviewsCompleted - dailyStats.again) /
                    dailyStats.reviewsCompleted) *
                    100)
                : 0,
        },
        noteBreakdown,
        struggled: struggled.map((c) => ({
            id: c === null || c === void 0 ? void 0 : c.id,
            question: c === null || c === void 0 ? void 0 : c.question,
            answer: c === null || c === void 0 ? void 0 : c.answer,
            sourceNoteName: c === null || c === void 0 ? void 0 : c.sourceNoteName,
            lapses: c === null || c === void 0 ? void 0 : c.lapses,
            stability: c === null || c === void 0 ? void 0 : c.stability,
        })),
        reviewedCards: cards,
    });
}
