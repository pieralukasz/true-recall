import {
	buildDayOfWeekStats,
	buildFilteredForecast,
	buildForecastSummary,
	type ForecastRange,
	forecastRangeToDays,
} from "@true-recall/core/metrics/forecast-filter";
import type { WorkloadDecision } from "@true-recall/core/metrics/fsrs-tools";
import type {
	WorkloadForecastEntry,
	WorkloadForecastSummary,
} from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";

export interface LoadBalanceForecastData {
	forecast: WorkloadForecastEntry[];
	summary: WorkloadForecastSummary;
	dayOfWeek: { day: number; dayName: string; avgCount: number }[];
	decision: WorkloadDecision;
}

type ForecastSource = Pick<FsrsPluginHost, "cardStore" | "fsrsHelper">;

/**
 * Build every load-balance visualization from one card snapshot.
 *
 * The settings screen previously asked FSRSHelperService for the forecast,
 * summary, weekday breakdown, and decision separately. Those calls repeated
 * full-card scans, and the summary also ran a complete balance dry-run merely
 * to decide whether to show its warning.
 */
export function buildLoadBalanceForecast(
	source: ForecastSource,
	range: ForecastRange,
	maxDeviation: number,
): LoadBalanceForecastData | null {
	const helper = source.fsrsHelper;
	if (!helper) return null;

	const cards = source.cardStore.getCards();
	const forecastDays = forecastRangeToDays(range, cards);
	const forecast = buildFilteredForecast(cards, forecastDays);
	const decision = helper.getWorkloadDecision();
	const summary = buildForecastSummary(
		forecast,
		decision.effectiveTarget,
		maxDeviation,
	);

	// Learning cards cannot be moved by load balancing. Base the warning on
	// review-card load only, without running the expensive scheduler dry-run.
	const threshold = decision.effectiveTarget * (1 + maxDeviation / 100);
	summary.needsBalancing = forecast.some(
		(entry) => entry.breakdown.young + entry.breakdown.mature > threshold,
	);

	return {
		forecast,
		summary,
		dayOfWeek: buildDayOfWeekStats(forecast),
		decision,
	};
}
