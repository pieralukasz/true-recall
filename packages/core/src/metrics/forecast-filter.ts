import { State } from "ts-fsrs";

import { isLearningState } from "@true-recall/core/helpers/card-state";
import type {
	WorkloadForecastEntry,
	WorkloadForecastSummary,
} from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";
import type { FSRSCardData } from "@true-recall/core/types";

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

	const forecast = new Map<string, { review: number; learning: number }>();

	const current = new Date(today);
	while (current <= endDate) {
		forecast.set(formatDate(current), { review: 0, learning: 0 });
		current.setDate(current.getDate() + 1);
	}

	for (const card of eligible) {
		const dateStr = formatDate(new Date(card.due));
		const bucket = forecast.get(dateStr);
		if (!bucket) continue;

		if (card.state === State.Review) {
			bucket.review++;
		} else if (isLearningState(card.state)) {
			bucket.learning++;
		}
	}

	const entries: WorkloadForecastEntry[] = [];
	for (const [date, breakdown] of forecast) {
		entries.push({
			date,
			dueCount: breakdown.review + breakdown.learning,
			breakdown,
		});
	}

	return entries.sort((a, b) => a.date.localeCompare(b.date));
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
		const dow = new Date(entry.date).getDay();
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

function formatDate(date: Date): string {
	return date.toISOString().split("T")[0] ?? "";
}
