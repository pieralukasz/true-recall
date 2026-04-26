import type { CardMaturityBreakdown, CardReviewLogEntry, CardsCreatedVsReviewedEntry, CreationSourceStats, ExtendedDailyStats, NotePerformanceRow, ProblemCard, StudyPattern, TimeToMasteryStats } from "../../../types";
import type { SqliteDatabase } from "../SqliteDatabase";
export type { ReviewLogForSync } from "./stats/review-log-actions";
export declare class StatsActions {
    private reviewLog;
    private reviewLogSync;
    private dailyProgress;
    private dailyProgressQuery;
    private analyticsCard;
    private analyticsPerformance;
    constructor(db: SqliteDatabase);
    addReviewLog(cardId: string, rating: number, scheduledDays: number, elapsedDays: number, state: number, timeSpentMs: number, presetName?: string): void;
    getCardReviewHistory(cardId: string, limit?: number): CardReviewLogEntry[];
    getTotalReviewCount(): number;
    getReviewCountForPreset(presetName: string): number;
    getPresetProgressInRange(startIso: string, endIso: string): {
        presetName: string;
        newStudied: number;
        reviewsCompleted: number;
    }[];
    updateReviewLogPresetName(oldName: string, newName: string): void;
    getAnswerStreakInfo(): {
        current: number;
        todayBest: number;
        allTimeBest: number;
    };
    getModifiedReviewLogSince(timestamp: number): {
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
    }[];
    upsertReviewLogFromRemote(data: {
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
    }): boolean;
    getReviewLogForSync(id: string): {
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
    } | null;
    deleteAllReviewLogForSync(): void;
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
    getDailyStats(date: string): ExtendedDailyStats | null;
    updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void;
    decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void;
    recordReviewedCard(date: string, cardId: string): void;
    getReviewedCardIds(date: string): string[];
    removeReviewedCard(date: string, cardId: string): void;
    rebuildDailyStatsFromReviewLog(): void;
    getAllDailyStats(): Record<string, ExtendedDailyStats>;
    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats>;
    getDailyStatsFromReviewLog(startDate: string, endDate: string, opts?: {
        presetNames?: string[];
        excludeSourceUids?: string[];
    }): ExtendedDailyStats[];
    getCardMaturityBreakdown(): CardMaturityBreakdown;
    getDueCardsByDate(startDate: string, endDate: string): {
        date: string;
        count: number;
    }[];
    getProblemCards(limit?: number): ProblemCard[];
    getStudyPatterns(): StudyPattern;
    getCardsCreatedByDate(startDate: string, endDate: string): {
        date: string;
        count: number;
    }[];
    getCardsCreatedOnDate(date: string): string[];
    getCardsCreatedVsReviewed(startDate: string, endDate: string): CardsCreatedVsReviewedEntry[];
    getTimeToMastery(): TimeToMasteryStats[];
    getReviewsForRetention(startDate: string, endDate: string, presetNames?: string[]): {
        date: string;
        rating: number;
    }[];
    getTrueRetention(startDate: string, endDate: string): number;
    getForecastDueByDay(days: number): {
        date: string;
        count: number;
    }[];
    getSiblingCards(sourceUid: string): {
        id: string;
        due: string;
        scheduledDays: number;
    }[];
    getNotePerformance(): NotePerformanceRow[];
    getCreationSourcePerformance(): CreationSourceStats[];
    getNotePerformanceFiltered(excludeSourceUids: string[], includeSourceUids?: string[]): NotePerformanceRow[];
}
