import type { DashboardAggregation } from "@true-recall/core/types/dashboard.types";
import type { CardSchedulingMeta } from "@true-recall/core/types/fsrs/card.types";
import type { TodaySummary } from "@true-recall/core/types/fsrs/stats.types";
interface AggregationDeps {
    allCards: CardSchedulingMeta[];
    streakCurrent: number;
    todaySummary: TodaySummary;
    newCardsCap: number;
    reviewsCap: number;
    archivedSourceUids?: ReadonlySet<string>;
}
export declare function aggregateDashboardData(deps: AggregationDeps): DashboardAggregation;
export {};
