import { AnalyticsCardActions } from "./stats/analytics-card-actions";
import { AnalyticsPerformanceActions } from "./stats/analytics-performance-actions";
import { DailyProgressActions } from "./stats/daily-progress-actions";
import { DailyProgressQueryActions } from "./stats/daily-progress-query-actions";
import { ReviewLogActions } from "./stats/review-log-actions";
import { ReviewLogSyncActions } from "./stats/review-log-sync-actions";
export class StatsActions {
    constructor(db) {
        this.reviewLog = new ReviewLogActions(db);
        this.reviewLogSync = new ReviewLogSyncActions(db);
        this.dailyProgress = new DailyProgressActions(db);
        this.dailyProgressQuery = new DailyProgressQueryActions(db);
        this.analyticsCard = new AnalyticsCardActions(db);
        this.analyticsPerformance = new AnalyticsPerformanceActions(db);
    }
    // ── Review log operations ─────────────────────────────────────
    addReviewLog(cardId, rating, scheduledDays, elapsedDays, state, timeSpentMs, presetName) {
        this.reviewLog.addReviewLog(cardId, rating, scheduledDays, elapsedDays, state, timeSpentMs, presetName);
    }
    getCardReviewHistory(cardId, limit = 20) {
        return this.reviewLog.getCardReviewHistory(cardId, limit);
    }
    getTotalReviewCount() {
        return this.reviewLog.getTotalReviewCount();
    }
    getReviewCountForPreset(presetName) {
        return this.reviewLog.getReviewCountForPreset(presetName);
    }
    getPresetProgressInRange(startIso, endIso) {
        return this.reviewLog.getPresetProgressInRange(startIso, endIso);
    }
    updateReviewLogPresetName(oldName, newName) {
        this.reviewLog.updateReviewLogPresetName(oldName, newName);
    }
    getAnswerStreakInfo() {
        return this.reviewLog.getAnswerStreakInfo();
    }
    getModifiedReviewLogSince(timestamp) {
        return this.reviewLogSync.getModifiedReviewLogSince(timestamp);
    }
    upsertReviewLogFromRemote(data) {
        return this.reviewLogSync.upsertReviewLogFromRemote(data);
    }
    getReviewLogForSync(id) {
        return this.reviewLogSync.getReviewLogForSync(id);
    }
    deleteAllReviewLogForSync() {
        this.reviewLogSync.deleteAllReviewLogForSync();
    }
    getReviewDataForOptimization(presetName) {
        return this.reviewLogSync.getReviewDataForOptimization(presetName);
    }
    // ── Daily progress operations ─────────────────────────────────
    getDailyStats(date) {
        return this.dailyProgress.getDailyStats(date);
    }
    updateDailyStats(date, stats) {
        this.dailyProgress.updateDailyStats(date, stats);
    }
    decrementDailyStats(date, stats) {
        this.dailyProgress.decrementDailyStats(date, stats);
    }
    recordReviewedCard(date, cardId) {
        this.dailyProgress.recordReviewedCard(date, cardId);
    }
    getReviewedCardIds(date) {
        return this.dailyProgress.getReviewedCardIds(date);
    }
    removeReviewedCard(date, cardId) {
        this.dailyProgress.removeReviewedCard(date, cardId);
    }
    rebuildDailyStatsFromReviewLog() {
        this.dailyProgress.rebuildDailyStatsFromReviewLog();
    }
    getAllDailyStats() {
        return this.dailyProgressQuery.getAllDailyStats();
    }
    getAllDailyStatsSummary() {
        return this.dailyProgressQuery.getAllDailyStatsSummary();
    }
    getDailyStatsFromReviewLog(startDate, endDate, opts) {
        return this.dailyProgressQuery.getDailyStatsFromReviewLog(startDate, endDate, opts);
    }
    // ── Analytics operations ──────────────────────────────────────
    getCardMaturityBreakdown() {
        return this.analyticsCard.getCardMaturityBreakdown();
    }
    getDueCardsByDate(startDate, endDate) {
        return this.analyticsCard.getDueCardsByDate(startDate, endDate);
    }
    getProblemCards(limit = 20) {
        return this.analyticsCard.getProblemCards(limit);
    }
    getStudyPatterns() {
        return this.analyticsCard.getStudyPatterns();
    }
    getCardsCreatedByDate(startDate, endDate) {
        return this.analyticsPerformance.getCardsCreatedByDate(startDate, endDate);
    }
    getCardsCreatedOnDate(date) {
        return this.analyticsPerformance.getCardsCreatedOnDate(date);
    }
    getCardsCreatedVsReviewed(startDate, endDate) {
        return this.analyticsPerformance.getCardsCreatedVsReviewed(startDate, endDate);
    }
    getTimeToMastery() {
        return this.analyticsPerformance.getTimeToMastery();
    }
    getReviewsForRetention(startDate, endDate, presetNames) {
        return this.analyticsPerformance.getReviewsForRetention(startDate, endDate, presetNames);
    }
    getTrueRetention(startDate, endDate) {
        return this.analyticsPerformance.getTrueRetention(startDate, endDate);
    }
    getForecastDueByDay(days) {
        return this.analyticsPerformance.getForecastDueByDay(days);
    }
    getSiblingCards(sourceUid) {
        return this.analyticsPerformance.getSiblingCards(sourceUid);
    }
    getNotePerformance() {
        return this.analyticsPerformance.getNotePerformance();
    }
    getCreationSourcePerformance() {
        return this.analyticsPerformance.getCreationSourcePerformance();
    }
    getNotePerformanceFiltered(excludeSourceUids, includeSourceUids) {
        return this.analyticsPerformance.getNotePerformanceFiltered(excludeSourceUids, includeSourceUids);
    }
}
