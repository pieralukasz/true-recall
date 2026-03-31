import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
import type { CardSchedulingMeta, CardsCreatedEntry, CardsCreatedVsReviewedEntry, ExtendedDailyStats, FutureDueEntry, RatingDistributionEntry, RetentionEntry, StatsTimeRange } from "../../../types";
export declare class ChartDataCalculator {
    private sqliteStore;
    constructor(sqliteStore?: SqliteStoreService | null);
    setSqliteStore(store: SqliteStoreService): void;
    getFutureDueStats(allCards: CardSchedulingMeta[], range: StatsTimeRange): FutureDueEntry[];
    getFutureDueStatsFilled(allCards: CardSchedulingMeta[], range: StatsTimeRange): FutureDueEntry[];
    getCardsCreatedHistoryFilled(allCards: CardSchedulingMeta[], range: StatsTimeRange): CardsCreatedEntry[];
    getCardsCreatedHistoryFilledSync(allCards: CardSchedulingMeta[], range: StatsTimeRange): CardsCreatedEntry[];
    getRatingDistributionHistory(allStats: Record<string, ExtendedDailyStats>, range: StatsTimeRange): RatingDistributionEntry[];
    getRetentionHistory(allStats: Record<string, ExtendedDailyStats>, range: StatsTimeRange): RetentionEntry[];
    getCardsCreatedVsReviewedHistory(range: StatsTimeRange): CardsCreatedVsReviewedEntry[];
    getCardsDueOnDate(allCards: CardSchedulingMeta[], date: string): CardSchedulingMeta[];
    getCardsCreatedOnDate(allCards: CardSchedulingMeta[], date: string): CardSchedulingMeta[];
    calculateEndDate(today: Date, range: StatsTimeRange): Date;
    calculateStartDate(today: Date, range: StatsTimeRange): Date;
}
