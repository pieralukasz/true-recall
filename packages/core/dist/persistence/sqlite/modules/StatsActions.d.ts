import type { SqliteDatabase } from "../SqliteDatabase";
import type { CardMaturityBreakdown, CardReviewLogEntry, CardsCreatedVsReviewedEntry, CreationSourceStats, ExtendedDailyStats, NotePerformanceRow, ProblemCard, StudyPattern, TimeToMasteryStats } from "../../../types";
export interface ReviewLogForSync {
    id: string;
    cardId: string;
    reviewedAt: string;
    rating: number;
    scheduledDays: number;
    elapsedDays: number;
    state: number;
    timeSpentMs: number;
    updatedAt: number;
    deletedAt: number | null;
    presetName: string | null;
}
export interface PresetDailyProgressRow {
    presetName: string;
    newStudied: number;
    reviewsCompleted: number;
}
export declare class StatsActions {
    private db;
    constructor(db: SqliteDatabase);
    addReviewLog(cardId: string, rating: number, scheduledDays: number, elapsedDays: number, state: number, timeSpentMs: number, presetName?: string): void;
    /**
     * Get review history for a card
     */
    getCardReviewHistory(cardId: string, limit?: number): CardReviewLogEntry[];
    /**
     * Get total review count
     */
    getTotalReviewCount(): number;
    getReviewCountForPreset(presetName: string): number;
    getPresetProgressInRange(startIso: string, endIso: string): PresetDailyProgressRow[];
    updateReviewLogPresetName(oldName: string, newName: string): void;
    getAnswerStreakInfo(): {
        current: number;
        todayBest: number;
        allTimeBest: number;
    };
    getDailyStats(date: string): ExtendedDailyStats | null;
    /**
     * Update daily stats (increment counters)
     */
    updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void;
    /**
     * Decrement daily stats (for undo functionality)
     */
    decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void;
    /**
     * Record a reviewed card for daily limits
     */
    recordReviewedCard(date: string, cardId: string): void;
    /**
     * Get all reviewed card IDs for a date
     */
    getReviewedCardIds(date: string): string[];
    /**
     * Remove a reviewed card entry (for undo)
     */
    removeReviewedCard(date: string, cardId: string): void;
    /**
     * Rebuild daily_stats and daily_reviewed_cards from review_log
     * Called after sync to ensure stats are consistent across devices
     */
    rebuildDailyStatsFromReviewLog(): void;
    /**
     * Get all daily stats (optimized with single JOIN query)
     */
    getAllDailyStats(): Record<string, ExtendedDailyStats>;
    /**
     * Get all daily stats summary (lightweight - no card IDs)
     */
    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats>;
    getCardMaturityBreakdown(): CardMaturityBreakdown;
    /**
     * Get due cards count by date range
     */
    getDueCardsByDate(startDate: string, endDate: string): {
        date: string;
        count: number;
    }[];
    /**
     * Get problem cards (high lapses, low stability, or relearning state)
     */
    getProblemCards(limit?: number): ProblemCard[];
    /**
     * Get study patterns from review history
     */
    getStudyPatterns(): StudyPattern;
    /**
     * Get cards created by date for historical chart
     */
    getCardsCreatedByDate(startDate: string, endDate: string): {
        date: string;
        count: number;
    }[];
    /**
     * Get cards created on a specific date
     */
    getCardsCreatedOnDate(date: string): string[];
    /**
     * Get cards created vs reviewed comparison data
     */
    getCardsCreatedVsReviewed(startDate: string, endDate: string): CardsCreatedVsReviewedEntry[];
    /**
     * Get time-to-mastery statistics
     * v15: No longer grouped by project (projects in frontmatter, not DB)
     * Returns single "All Cards" group
     */
    getTimeToMastery(): TimeToMasteryStats[];
    getModifiedReviewLogSince(timestamp: number): ReviewLogForSync[];
    upsertReviewLogFromRemote(data: ReviewLogForSync): void;
    getReviewLogForSync(id: string): ReviewLogForSync | null;
    /**
     * Delete all review log entries (for force pull sync)
     */
    deleteAllReviewLogForSync(): void;
    /**
     * Get review data for FSRS parameter optimization
     * Returns review history with card states for the optimizer algorithm
     */
    getReviewDataForOptimization(presetName?: string): {
        cardId: string;
        reviewedAt: number;
        rating: number;
        scheduledDays: number;
        elapsedDays: number;
        state: number;
        stability: number;
        difficulty: number;
    }[];
    /**
     * Get review data for true retention calculation
     * Only includes reviews on mature cards (state = 2, Review state)
     */
    getReviewsForRetention(startDate: string, endDate: string, presetNames?: string[]): {
        date: string;
        rating: number;
    }[];
    /**
     * Get true retention (Good + Easy) / Total for mature cards only
     */
    getTrueRetention(startDate: string, endDate: string): number;
    /**
     * Get forecast of cards due per day
     */
    getForecastDueByDay(days: number): {
        date: string;
        count: number;
    }[];
    /**
     * Get sibling cards (cards sharing the same source_uid)
     */
    getSiblingCards(sourceUid: string): {
        id: string;
        due: string;
        scheduledDays: number;
    }[];
    getNotePerformance(): NotePerformanceRow[];
    getCreationSourcePerformance(): CreationSourceStats[];
    getDailyStatsFromReviewLog(startDate: string, endDate: string, opts?: {
        presetNames?: string[];
        excludeSourceUids?: string[];
    }): ExtendedDailyStats[];
    getNotePerformanceFiltered(excludeSourceUids: string[], includeSourceUids?: string[]): NotePerformanceRow[];
}
