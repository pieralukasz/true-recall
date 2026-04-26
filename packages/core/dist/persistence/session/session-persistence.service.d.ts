import { State } from "ts-fsrs";
import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
import type { ExtendedDailyStats, Grade } from "@true-recall/core/types";
export interface PresetDailyProgress {
    newStudied: number;
    reviewsCompleted: number;
}
export declare class SessionPersistenceService {
    private persistence;
    private store;
    private dayBoundaryService;
    constructor(persistence: IPersistence, store: SqliteStoreService, dayBoundaryService: DayBoundaryService);
    /**
     * Get today's date in YYYY-MM-DD format (respects dayStartHour)
     * At 3 AM with dayStartHour=4, returns yesterday's date
     */
    getTodayKey(): string;
    /**
     * Get today's stats (creates empty if not exists)
     */
    getTodayStats(): ExtendedDailyStats;
    /**
     * Record a card review with extended stats
     */
    recordReview(cardId: string, isNewCard: boolean, durationMs: number, rating?: Grade, previousState?: State, scheduledDays?: number, elapsedDays?: number, presetName?: string): void;
    removeReviewedCards(cardIds: string[]): void;
    /**
     * Get set of cards reviewed today (for queue exclusion)
     */
    getReviewedToday(): Set<string>;
    /**
     * Get count of new cards studied today
     */
    getNewCardsStudiedToday(): number;
    /**
     * Get count of Review-state cards reviewed today (excludes Learning/Relearning)
     */
    getReviewCardsCompletedToday(): number;
    getTodayProgressByPreset(): Map<string, PresetDailyProgress>;
    /**
     * Remove the last review (for undo functionality)
     */
    removeLastReview(cardId: string, wasNewCard: boolean, rating?: Grade, previousState?: State): void;
    /**
     * Get all daily stats (includes card IDs - use for migrations/specific card lookups)
     */
    getAllDailyStats(): Record<string, ExtendedDailyStats>;
    /**
     * Get all daily stats summary (lightweight - no card IDs)
     * Use this for charts and heatmaps where individual card IDs aren't needed.
     */
    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats>;
    /**
     * Get stats in a date range
     * @param startDate Start date in YYYY-MM-DD format
     * @param endDate End date in YYYY-MM-DD format
     */
    getStatsInRange(startDate: string, endDate: string): ExtendedDailyStats[];
    /**
     * Invalidate cache (no-op for SQL, kept for API compatibility)
     */
    invalidateCache(): void;
    /**
     * Migrate stats from JSON file to SQL (one-time migration)
     * Call this during plugin initialization after SQL store is ready
     */
    migrateStatsJsonToSql(): Promise<void>;
    private createEmptyDayStats;
}
