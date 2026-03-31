import type { DistributionStats, HistogramBucket } from "@true-recall/core/metrics/fsrs-tools/statistics/distribution.calculator";
import type { CardSchedulingMeta } from "@true-recall/core/types";
export declare function getFilteredDistributions(cards: CardSchedulingMeta[]): {
    interval: {
        histogram: HistogramBucket[];
        stats: DistributionStats;
    };
    stability: {
        histogram: HistogramBucket[];
        stats: DistributionStats;
    };
    difficulty: {
        histogram: HistogramBucket[];
        stats: DistributionStats;
    };
};
