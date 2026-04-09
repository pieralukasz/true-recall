/**
 * Workload Forecast Calculator
 *
 * Predicts future review workload based on current card scheduling.
 */

import { State } from "ts-fsrs";

import { isLearningState } from "../../../helpers/card-state";
import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
import { formatLocalDate } from "../../../utils";

/**
 * Daily workload forecast entry
 */
export interface WorkloadForecastEntry {
	/** Date (ISO date string) */
	date: string;
	/** Number of reviews due */
	dueCount: number;
	/** Breakdown by card state */
	breakdown: {
		/** Cards in Review state */
		review: number;
		/** Cards in Learning/Relearning state */
		learning: number;
	};
}

/**
 * Workload forecast summary
 */
export interface WorkloadForecastSummary {
	/** Average daily workload */
	avgDaily: number;
	/** Peak day */
	peakDay: { date: string; count: number };
	/** Minimum day */
	minDay: { date: string; count: number };
	/** Days above target */
	daysAboveTarget: number;
	/** Recommended balance */
	needsBalancing: boolean;
}

/**
 * Workload Forecast Calculator
 *
 * Analyzes scheduled cards to predict future workload,
 * helping users plan their study time.
 */
export class WorkloadForecastCalculator {
	constructor(private cardStore: SqliteStoreService) {}

	/**
	 * Get workload forecast for the next N days
	 */
	getForecast(
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
	): WorkloadForecastEntry[] {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const cards = this.cardStore
			.getCards()
			.filter(
				(c) =>
					!c.suspended &&
					(!c.buriedUntil || new Date(c.buriedUntil) <= today) &&
					new Date(c.due) >= today &&
					new Date(c.due) <= endDate &&
					(!excludeSourceUids || !excludeSourceUids.has(c.sourceUid ?? "")),
			);

		// Build forecast by date
		const forecast = new Map<string, { review: number; learning: number }>();

		const currentDate = new Date(today);
		while (currentDate <= endDate) {
			forecast.set(formatLocalDate(currentDate), { review: 0, learning: 0 });
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Count cards by date and state
		for (const card of cards) {
			const dateStr = formatLocalDate(new Date(card.due));
			const existing = forecast.get(dateStr);

			if (existing) {
				// State.New = 0 (not counted in forecast)
				// State.Learning = 1, State.Relearning = 3
				// State.Review = 2
				if (card.state === State.Review) {
					existing.review++;
				} else if (isLearningState(card.state)) {
					existing.learning++;
				}
			}
		}

		// Convert to entries
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

	/**
	 * Get summary statistics for the forecast
	 */
	getSummary(
		targetPerDay: number,
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
	): WorkloadForecastSummary {
		const forecast = this.getForecast(days, excludeSourceUids);

		if (forecast.length === 0) {
			return {
				avgDaily: 0,
				peakDay: { date: "", count: 0 },
				minDay: { date: "", count: 0 },
				daysAboveTarget: 0,
				needsBalancing: false,
			};
		}

		// Calculate statistics
		let total = 0;
		let peakDay = forecast[0] ?? {
			date: "",
			dueCount: 0,
			breakdown: { review: 0, learning: 0 },
		};
		let minDay = forecast[0] ?? {
			date: "",
			dueCount: 0,
			breakdown: { review: 0, learning: 0 },
		};
		let daysAboveTarget = 0;

		for (const entry of forecast) {
			total += entry.dueCount;

			if (entry.dueCount > peakDay.dueCount) {
				peakDay = entry;
			}
			if (entry.dueCount < minDay.dueCount) {
				minDay = entry;
			}
			if (entry.dueCount > targetPerDay) {
				daysAboveTarget++;
			}
		}

		const avgDaily = total / forecast.length;

		// Determine if balancing is recommended
		// (if peak is more than 50% above average, or more than 20% of days exceed target)
		const needsBalancing =
			peakDay.dueCount > avgDaily * 1.5 ||
			daysAboveTarget > forecast.length * 0.2;

		return {
			avgDaily: Math.round(avgDaily),
			peakDay: { date: peakDay.date, count: peakDay.dueCount },
			minDay: { date: minDay.date, count: minDay.dueCount },
			daysAboveTarget,
			needsBalancing,
		};
	}

	/**
	 * Get cumulative workload (total reviews needed by each date)
	 */
	getCumulativeForecast(
		days: number = 30,
	): { date: string; cumulative: number }[] {
		const forecast = this.getForecast(days);

		let cumulative = 0;
		return forecast.map((entry) => {
			cumulative += entry.dueCount;
			return {
				date: entry.date,
				cumulative,
			};
		});
	}

	/**
	 * Get workload by day of week
	 */
	getWorkloadByDayOfWeek(
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
	): { day: number; dayName: string; avgCount: number }[] {
		const forecast = this.getForecast(days, excludeSourceUids);

		// Group by day of week
		const byDay = new Map<number, number[]>();
		for (let i = 0; i < 7; i++) {
			byDay.set(i, []);
		}

		for (const entry of forecast) {
			const dayOfWeek = new Date(entry.date).getDay();
			byDay.get(dayOfWeek)?.push(entry.dueCount);
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
}
