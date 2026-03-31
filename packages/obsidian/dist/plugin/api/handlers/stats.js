import { formatLocalDate } from "@true-recall/core/utils";
import { sendError, sendOk } from "../api.types";
export function handleGetSummary(_req, res, ctx) {
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const today = formatLocalDate(new Date());
    const dailyStats = ctx.plugin.cardStore.stats.getDailyStats(today);
    const maturity = ctx.plugin.cardStore.stats.getCardMaturityBreakdown();
    const streaks = ctx.plugin.cardStore.stats.getAnswerStreakInfo();
    const totalReviews = ctx.plugin.cardStore.stats.getTotalReviewCount();
    const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();
    let allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
    if (archivedUids.size > 0) {
        allCards = allCards.filter((c) => !c.sourceUid || !archivedUids.has(c.sourceUid));
    }
    const totalCards = allCards.length;
    const dueCards = ctx.plugin.dayBoundaryService.getDueCards(allCards);
    sendOk(res, {
        date: today,
        totalCards,
        dueCount: dueCards.length,
        totalReviews,
        today: dailyStats
            ? {
                reviewsCompleted: dailyStats.reviewsCompleted,
                newCardsStudied: dailyStats.newCardsStudied,
                totalTimeMs: dailyStats.totalTimeMs,
                again: dailyStats.again,
                hard: dailyStats.hard,
                good: dailyStats.good,
                easy: dailyStats.easy,
            }
            : null,
        maturity,
        streaks,
    });
}
export function handleGetDailyStats(req, res, ctx) {
    var _a;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://localhost");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end) {
        sendError(res, 400, "Query params start and end (YYYY-MM-DD) required");
        return;
    }
    const days = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
        const dateStr = formatLocalDate(current);
        const stats = ctx.plugin.cardStore.stats.getDailyStats(dateStr);
        if (stats) {
            days.push({
                date: stats.date,
                reviewsCompleted: stats.reviewsCompleted,
                newCardsStudied: stats.newCardsStudied,
                totalTimeMs: stats.totalTimeMs,
                again: stats.again,
                hard: stats.hard,
                good: stats.good,
                easy: stats.easy,
            });
        }
        current.setDate(current.getDate() + 1);
    }
    sendOk(res, { days });
}
export function handleGetPatterns(_req, res, ctx) {
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const patterns = ctx.plugin.cardStore.stats.getStudyPatterns();
    sendOk(res, patterns);
}
