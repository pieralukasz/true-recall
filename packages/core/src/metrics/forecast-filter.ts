import { State } from "ts-fsrs";

import { isLearningState } from "@true-recall/core/helpers/card-state";
import {
	MATURE_INTERVAL_DAYS,
	toEntries,
	type WorkloadForecastEntry,
	type WorkloadForecastSummary,
} from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import type { FSRSCardData } from "@true-recall/core/types";
import { formatLocalDate } from "@true-recall/core/utils/date.utils";

/**
 * Build forecast entries from a pre-filtered card list.
 * Mirrors WorkloadForecastCalculator.getForecast() logic
 * but works on any card subset (e.g. filtered by preset).
 */
export function buildFilteredForecast(
	cards: FSRSCardData[],
	days: number = 30,
): WorkloadForecastEntry[] {
	const today = new Date();
	const endDate = new Date(today);
	endDate.setDate(endDate.getDate() + days);

	const eligible = cards.filter(
		(c) =>
			!c.suspended &&
			(!c.buriedUntil || new Date(c.buriedUntil) <= today) &&
			new Date(c.due) >= today &&
			new Date(c.due) <= endDate,
	);

	const forecast = new Map<
		string,
		{ young: number; mature: number; learning: number }
	>();

	const current = new Date(today);
	while (current <= endDate) {
		forecast.set(formatDate(current), { young: 0, mature: 0, learning: 0 });
		current.setDate(current.getDate() + 1);
	}

	for (const card of eligible) {
		const dateStr = formatDate(new Date(card.due));
		const bucket = forecast.get(dateStr);
		if (!bucket) continue;

		if (card.state === State.Review) {
			if (card.scheduledDays < MATURE_INTERVAL_DAYS) bucket.young++;
			else bucket.mature++;
		} else if (isLearningState(card.state)) {
			bucket.learning++;
		}
	}

	return toEntries(forecast);
}

export function buildForecastSummary(
	forecast: WorkloadForecastEntry[],
	targetPerDay: number,
	maxDeviation: number = 20,
): WorkloadForecastSummary {
	if (forecast.length === 0) {
		return {
			avgDaily: 0,
			peakDay: { date: "", count: 0 },
			minDay: { date: "", count: 0 },
			daysAboveTarget: 0,
			needsBalancing: false,
		};
	}

	let total = 0;
	const first = forecast[0];
	if (!first)
		return {
			avgDaily: 0,
			peakDay: { date: "", count: 0 },
			minDay: { date: "", count: 0 },
			daysAboveTarget: 0,
			needsBalancing: false,
		};
	let peakDay = first;
	let minDay = first;
	let daysAboveTarget = 0;

	for (const entry of forecast) {
		total += entry.dueCount;
		if (entry.dueCount > peakDay.dueCount) peakDay = entry;
		if (entry.dueCount < minDay.dueCount) minDay = entry;
		if (entry.dueCount > targetPerDay) daysAboveTarget++;
	}

	const avgDaily = total / forecast.length;
	const threshold = targetPerDay * (1 + maxDeviation / 100);
	const needsBalancing = peakDay.dueCount > threshold;

	return {
		avgDaily: Math.round(avgDaily),
		peakDay: { date: peakDay.date, count: peakDay.dueCount },
		minDay: { date: minDay.date, count: minDay.dueCount },
		daysAboveTarget,
		needsBalancing,
	};
}

export function buildDayOfWeekStats(
	forecast: WorkloadForecastEntry[],
): { day: number; dayName: string; avgCount: number }[] {
	const byDay = new Map<number, number[]>();
	for (let i = 0; i < 7; i++) byDay.set(i, []);

	for (const entry of forecast) {
		// entry.date is a date-only string parsed as UTC midnight, so the
		// weekday must be read in UTC — getDay() shifts it west of UTC.
		const dow = new Date(entry.date).getUTCDay();
		byDay.get(dow)?.push(entry.dueCount);
	}

	const dayNames = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];

	return Array.from(byDay.entries())
		.map(([day, counts]) => ({
			day,
			dayName: dayNames[day] ?? "Unknown",
			avgCount:
				counts.length > 0
					? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
					: 0,
		}))
		.sort((a, b) => a.day - b.day);
}

// Key days by the user's local calendar date, matching
// WorkloadForecastCalculator.getForecast(); toISOString() would shift
// evening/night due times into the neighboring UTC day.
function formatDate(date: Date): string {
	return formatLocalDate(date);
}

/** Selectable forecast horizon, mirroring Anki's Future Due ranges. */
export type ForecastRange = "1m" | "3m" | "1y" | "all";

const MS_PER_DAY = 86_400_000;
/** Cap "all" so a far-future outlier card can't produce thousands of bars. */
const MAX_FORECAST_DAYS = 365 * 5;

/**
 * Resolve a forecast range to a day horizon. For "all", scan the card set for
 * the furthest due date (capped) so the chart spans the whole backlog.
 */
export function forecastRangeToDays(
	range: ForecastRange,
	cards: FSRSCardData[],
): number {
	switch (range) {
		case "1m":
			return 30;
		case "3m":
			return 90;
		case "1y":
			return 365;
		case "all": {
			const today = Date.now();
			let maxDays = 30;
			for (const c of cards) {
				if (c.suspended) continue;
				const diff = Math.ceil(
					(new Date(c.due).getTime() - today) / MS_PER_DAY,
				);
				if (diff > maxDays) maxDays = diff;
			}
			return Math.min(maxDays, MAX_FORECAST_DAYS);
		}
	}
}
