import type { WorkloadForecastEntry, WorkloadForecastSummary } from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import type { FSRSCardData } from "@true-recall/core/types";
/**
 * Build forecast entries from a pre-filtered card list.
 * Mirrors WorkloadForecastCalculator.getForecast() logic
 * but works on any card subset (e.g. filtered by preset).
 */
export declare function buildFilteredForecast(cards: FSRSCardData[], days?: number): WorkloadForecastEntry[];
export declare function buildForecastSummary(forecast: WorkloadForecastEntry[], targetPerDay: number): WorkloadForecastSummary;
export declare function buildDayOfWeekStats(forecast: WorkloadForecastEntry[]): {
    day: number;
    dayName: string;
    avgCount: number;
}[];
