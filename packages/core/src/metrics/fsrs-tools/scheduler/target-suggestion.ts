/**
 * Target Suggestion
 *
 * Pure math behind the "conscious daily target": suggest a daily review
 * target anchored in the user's demonstrated pace, and project when the
 * backlog reaches zero at a given target.
 */

import { formatLocalDate } from "../../../utils";

/** Active days required before pace statistics are trusted */
export const MIN_ACTIVE_DAYS = 7;

/** How far back demonstrated pace is measured */
export const PACE_LOOKBACK_DAYS = 60;

export interface PaceStats {
	/** Median reviews completed on days with at least one review */
	medianPace: number;
	/** 75th percentile of reviews completed on active days */
	p75Pace: number;
	/** Days with at least one review in the lookback window */
	activeDays: number;
}

export interface CatchUpProjection {
	/** Days until the backlog reaches zero; null = never at this target */
	days: number | null;
	/** Local date (YYYY-MM-DD) when the backlog reaches zero; null = never */
	date: string | null;
}

export function computePaceStats(dailyReviewCounts: number[]): PaceStats {
	const active = dailyReviewCounts
		.filter((count) => count > 0)
		.sort((a, b) => a - b);
	return {
		medianPace: percentile(active, 0.5),
		p75Pace: percentile(active, 0.75),
		activeDays: active.length,
	};
}

/**
 * The pace below which the backlog grows by definition: upcoming dues per
 * day, plus one when a backlog exists so it strictly shrinks.
 */
export function computeTargetFloor(
	steadyStatePerDay: number,
	backlogSize: number,
): number {
	return steadyStatePerDay + (backlogSize > 0 ? 1 : 0);
}

/**
 * Suggested daily target: demonstrated median pace, floored at the water
 * line. Null when pace history is too thin to trust (fewer than
 * MIN_ACTIVE_DAYS active days) — callers fall back to the forecast average.
 */
export function computeSuggestedTarget(
	pace: PaceStats,
	steadyStatePerDay: number,
	backlogSize: number,
): number | null {
	if (pace.activeDays < MIN_ACTIVE_DAYS) return null;
	return Math.max(
		pace.medianPace,
		computeTargetFloor(steadyStatePerDay, backlogSize),
	);
}

/**
 * When the backlog hits zero at a given target: each day the target first
 * covers that day's fresh dues (steady state) and only the surplus pays
 * down the backlog.
 */
export function projectCatchUp(
	targetPerDay: number,
	steadyStatePerDay: number,
	backlogSize: number,
	from: Date,
): CatchUpProjection {
	if (backlogSize <= 0) return { days: 0, date: formatLocalDate(from) };
	const surplus = targetPerDay - steadyStatePerDay;
	if (surplus <= 0) return { days: null, date: null };
	const days = Math.ceil(backlogSize / surplus);
	const date = new Date(from);
	date.setDate(date.getDate() + days);
	return { days, date: formatLocalDate(date) };
}

/** Linear-interpolated percentile of an ascending sample; 0 when empty */
function percentile(sortedAscending: number[], p: number): number {
	if (sortedAscending.length === 0) return 0;
	const rank = (sortedAscending.length - 1) * p;
	const low = Math.floor(rank);
	const lowValue = sortedAscending[low] ?? 0;
	const highValue = sortedAscending[Math.ceil(rank)] ?? lowValue;
	return Math.round(lowValue + (highValue - lowValue) * (rank - low));
}
