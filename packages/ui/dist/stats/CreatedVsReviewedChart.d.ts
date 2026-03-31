import type { CardsCreatedEntry, ExtendedDailyStats } from "@true-recall/core";
interface CreatedVsReviewedChartProps {
    created: CardsCreatedEntry[];
    reviewHistory: ExtendedDailyStats[];
}
export declare function CreatedVsReviewedChart({ created, reviewHistory, }: CreatedVsReviewedChartProps): import("preact").JSX.Element;
export {};
