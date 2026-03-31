import type { FlashcardManager } from "../../flashcard/flashcard.service";
import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../../services/fsrs/fsrs.service";
import type { CardMaturityBreakdown, CardSchedulingMeta, CardsCreatedEntry, CollectionHealthSnapshot, ExtendedDailyStats, FutureDueEntry, NotePerformanceRow, RatingDistributionEntry, RetentionEntry, StatsTimeRange, TodaySummary } from "../../types";
import { type StreakInfo } from "./calculators";
import { type StatsFilterContext } from "./stats-filter.types";
/**
 * Platform-agnostic session persistence interface for stats.
 */
export interface ISessionPersistenceForStats {
    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats>;
    getStatsInRange(startKey: string, endKey: string): ExtendedDailyStats[];
    getTodayStats(): ExtendedDailyStats;
}
export declare class StatsCalculatorService {
    private flashcardManager;
    private sessionPersistence;
    private fsrsService;
    private sqliteStore;
    private dayStartHour;
    private filter;
    private filterCacheKey;
    private cardSnapshot;
    private filteredCardsCache;
    private dailyStatsCache;
    private dailyStatsRangeCache;
    private healthCache;
    private streakCalculator;
    private maturityCalculator;
    private chartDataCalculator;
    constructor(fsrsService: FSRSService, flashcardManager: FlashcardManager, sessionPersistence: ISessionPersistenceForStats, dayStartHour?: number);
    setSqliteStore(store: SqliteStoreService): void;
    setDayStartHour(hour: number): void;
    setFilter(ctx: StatsFilterContext): void;
    setCardSnapshot(cards: CardSchedulingMeta[]): void;
    private get isFilterActive();
    private getFilteredCards;
    private getFilteredDailyStats;
    private getFilteredDailyStatsInRange;
    getAllDailyStats(): Record<string, ExtendedDailyStats>;
    getCardMaturityBreakdown(): CardMaturityBreakdown;
    getFutureDueStats(range: StatsTimeRange): FutureDueEntry[];
    getReviewHistory(range: StatsTimeRange): ExtendedDailyStats[];
    getReviewHistorySync(range: StatsTimeRange): ExtendedDailyStats[];
    getTodaySummary(): TodaySummary;
    getStreakInfo(): StreakInfo;
    getRangeSummary(range: StatsTimeRange): {
        daysStudied: number;
        totalDays: number;
        totalReviews: number;
        avgPerDay: number;
        avgForStudiedDays: number;
        dueTomorrow: number;
        dailyLoad: number;
    };
    getRangeSummarySync(range: StatsTimeRange): {
        daysStudied: number;
        totalDays: number;
        totalReviews: number;
        avgPerDay: number;
        avgForStudiedDays: number;
        dueTomorrow: number;
        dailyLoad: number;
    };
    getRatingDistributionHistory(range: StatsTimeRange): RatingDistributionEntry[];
    getCollectionHealthSnapshot(): CollectionHealthSnapshot;
    getNotePerformance(): NotePerformanceRow[];
    getRetentionHistory(range: StatsTimeRange): RetentionEntry[];
    private calculateStartDate;
    getFutureDueStatsFilled(range: StatsTimeRange): FutureDueEntry[];
    getCardsDueOnDate(date: string): CardSchedulingMeta[];
    getCardsByCategory(category: keyof CardMaturityBreakdown): CardSchedulingMeta[];
    getCardsCreatedHistoryFilled(range: StatsTimeRange): CardsCreatedEntry[];
    getCardsCreatedHistoryFilledSync(range: StatsTimeRange): CardsCreatedEntry[];
    getCardsCreatedOnDate(date: string): CardSchedulingMeta[];
    private clearDailyStatsCaches;
    private buildFilterCacheKey;
}
