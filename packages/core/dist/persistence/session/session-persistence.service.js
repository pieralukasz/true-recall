import { __awaiter } from "tslib";
import { Rating, State } from "ts-fsrs";
import { isLearningState } from "@true-recall/core/helpers/card-state";
const STATS_FOLDER = ".true-recall";
const STATS_FILE = "stats.json";
export class SessionPersistenceService {
    constructor(persistence, store, dayBoundaryService) {
        this.persistence = persistence;
        this.store = store;
        this.dayBoundaryService = dayBoundaryService;
    }
    /**
     * Get today's date in YYYY-MM-DD format (respects dayStartHour)
     * At 3 AM with dayStartHour=4, returns yesterday's date
     */
    getTodayKey() {
        return this.dayBoundaryService.getTodayKey();
    }
    /**
     * Get today's stats (creates empty if not exists)
     */
    getTodayStats() {
        const today = this.getTodayKey();
        const stats = this.store.stats.getDailyStats(today);
        if (stats) {
            return stats;
        }
        return this.createEmptyDayStats(today);
    }
    /**
     * Record a card review with extended stats
     */
    recordReview(cardId, isNewCard, durationMs, rating, previousState, scheduledDays, elapsedDays, presetName) {
        const today = this.getTodayKey();
        // Record the reviewed card (for daily limit tracking)
        this.store.stats.recordReviewedCard(today, cardId);
        // Build stats increment
        const statsIncrement = {
            reviewsCompleted: 1,
            totalTimeMs: durationMs,
            newCardsStudied: isNewCard ? 1 : 0,
            // Rating breakdown
            again: rating === Rating.Again ? 1 : 0,
            hard: rating === Rating.Hard ? 1 : 0,
            good: rating === Rating.Good ? 1 : 0,
            easy: rating === Rating.Easy ? 1 : 0,
            // Card type breakdown
            newCards: previousState === State.New ? 1 : 0,
            learningCards: previousState != null && isLearningState(previousState) ? 1 : 0,
            reviewCards: previousState === State.Review ? 1 : 0,
        };
        this.store.stats.updateDailyStats(today, statsIncrement);
        // Record to review_log for detailed history
        if (rating !== undefined) {
            this.store.stats.addReviewLog(cardId, rating, scheduledDays !== null && scheduledDays !== void 0 ? scheduledDays : 0, elapsedDays !== null && elapsedDays !== void 0 ? elapsedDays : 0, previousState !== null && previousState !== void 0 ? previousState : 0, durationMs, presetName);
        }
    }
    removeReviewedCards(cardIds) {
        const today = this.getTodayKey();
        for (const cardId of cardIds) {
            this.store.stats.removeReviewedCard(today, cardId);
        }
    }
    /**
     * Get set of cards reviewed today (for queue exclusion)
     */
    getReviewedToday() {
        const today = this.getTodayKey();
        const cardIds = this.store.stats.getReviewedCardIds(today);
        return new Set(cardIds);
    }
    /**
     * Get count of new cards studied today
     */
    getNewCardsStudiedToday() {
        var _a;
        const today = this.getTodayKey();
        const stats = this.store.stats.getDailyStats(today);
        return (_a = stats === null || stats === void 0 ? void 0 : stats.newCardsStudied) !== null && _a !== void 0 ? _a : 0;
    }
    /**
     * Get count of Review-state cards reviewed today (excludes Learning/Relearning)
     */
    getReviewCardsCompletedToday() {
        var _a;
        const today = this.getTodayKey();
        const stats = this.store.stats.getDailyStats(today);
        return (_a = stats === null || stats === void 0 ? void 0 : stats.reviewCards) !== null && _a !== void 0 ? _a : 0;
    }
    getTodayProgressByPreset() {
        const start = this.dayBoundaryService.getTodayBoundary();
        const end = this.dayBoundaryService.getTomorrowBoundary();
        const rows = this.store.stats.getPresetProgressInRange(start.toISOString(), end.toISOString());
        const progress = new Map();
        for (const row of rows) {
            progress.set(row.presetName, {
                newStudied: row.newStudied,
                reviewsCompleted: row.reviewsCompleted,
            });
        }
        return progress;
    }
    /**
     * Remove the last review (for undo functionality)
     */
    removeLastReview(cardId, wasNewCard, rating, previousState) {
        const today = this.getTodayKey();
        // Build stats decrement
        const statsDecrement = {
            reviewsCompleted: 1,
            newCardsStudied: wasNewCard ? 1 : 0,
            // Rating breakdown
            again: rating === Rating.Again ? 1 : 0,
            hard: rating === Rating.Hard ? 1 : 0,
            good: rating === Rating.Good ? 1 : 0,
            easy: rating === Rating.Easy ? 1 : 0,
            // Card type breakdown
            newCards: previousState === State.New ? 1 : 0,
            learningCards: previousState != null && isLearningState(previousState) ? 1 : 0,
            reviewCards: previousState === State.Review ? 1 : 0,
        };
        this.store.stats.decrementDailyStats(today, statsDecrement);
        // Remove from daily_reviewed_cards when reverting a first review so
        // countByState doesn't hide the card from panel header counts.
        if (previousState === State.New) {
            this.store.stats.removeReviewedCard(today, cardId);
        }
    }
    /**
     * Get all daily stats (includes card IDs - use for migrations/specific card lookups)
     */
    getAllDailyStats() {
        return this.store.stats.getAllDailyStats();
    }
    /**
     * Get all daily stats summary (lightweight - no card IDs)
     * Use this for charts and heatmaps where individual card IDs aren't needed.
     */
    getAllDailyStatsSummary() {
        return this.store.stats.getAllDailyStatsSummary();
    }
    /**
     * Get stats in a date range
     * @param startDate Start date in YYYY-MM-DD format
     * @param endDate End date in YYYY-MM-DD format
     */
    getStatsInRange(startDate, endDate) {
        const allStats = this.store.stats.getAllDailyStatsSummary();
        const result = [];
        for (const [date, dayStats] of Object.entries(allStats)) {
            if (date >= startDate && date <= endDate) {
                result.push(dayStats);
            }
        }
        // Sort by date ascending
        return result.sort((a, b) => a.date.localeCompare(b.date));
    }
    /**
     * Invalidate cache (no-op for SQL, kept for API compatibility)
     */
    invalidateCache() {
        // No-op: SQLite doesn't use a separate cache layer
    }
    /**
     * Migrate stats from JSON file to SQL (one-time migration)
     * Call this during plugin initialization after SQL store is ready
     */
    migrateStatsJsonToSql() {
        return __awaiter(this, void 0, void 0, function* () {
            const statsPath = `${STATS_FOLDER}/${STATS_FILE}`;
            try {
                const exists = yield this.persistence.exists(statsPath);
                if (!exists) {
                    return; // No JSON file to migrate
                }
                const content = yield this.persistence.read(statsPath);
                const data = JSON.parse(content);
                for (const [date, dayStats] of Object.entries(data.daily)) {
                    const extendedStats = dayStats;
                    // Migrate stats (use updateDailyStats which does UPSERT)
                    this.store.stats.updateDailyStats(date, {
                        reviewsCompleted: extendedStats.reviewsCompleted || 0,
                        newCardsStudied: extendedStats.newCardsStudied || 0,
                        totalTimeMs: extendedStats.totalTimeMs || 0,
                        again: extendedStats.again || 0,
                        hard: extendedStats.hard || 0,
                        good: extendedStats.good || 0,
                        easy: extendedStats.easy || 0,
                        newCards: extendedStats.newCards || 0,
                        learningCards: extendedStats.learningCards || 0,
                        reviewCards: extendedStats.reviewCards || 0,
                    });
                    // Migrate reviewed card IDs
                    for (const cardId of extendedStats.reviewedCardIds || []) {
                        this.store.stats.recordReviewedCard(date, cardId);
                    }
                }
                // Flush to ensure data is persisted
                yield this.store.saveNow();
                yield this.persistence.remove(statsPath);
            }
            catch (error) {
                console.error("[True Recall] Failed to migrate stats.json:", error);
                // Don't throw - migration failure shouldn't block plugin startup
            }
        });
    }
    createEmptyDayStats(date) {
        return {
            date,
            reviewedCardIds: [],
            newCardsStudied: 0,
            reviewsCompleted: 0,
            totalTimeMs: 0,
            // Extended fields for statistics panel
            again: 0,
            hard: 0,
            good: 0,
            easy: 0,
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
        };
    }
}
