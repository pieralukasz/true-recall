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
 * Sort a date→breakdown map into forecast entries, computing dueCount
 * and a running cumulative total in chronological order.
 */
export function toEntries(
	byDate: Map<string, { young: number; mature: number; learning: number }>,
): WorkloadForecastEntry[] {
	const sorted = Array.from(byDate.entries()).sort((a, b) =>
		a[0].localeCompare(b[0]),
	);

	let cumulative = 0;
	return sorted.map(([date, breakdown]) => {
		const dueCount = breakdown.young + breakdown.mature + breakdown.learning;
		cumulative += dueCount;
		return { date, dueCount, cumulative, breakdown };
	});
}

/** Review-card maturity threshold in days (matches MaturityCalculator). */
export const MATURE_INTERVAL_DAYS = 21;

/**
 * Daily workload forecast entry
 */
export interface WorkloadForecastEntry {
	/** Date (ISO date string) */
	date: string;
	/** Number of reviews due */
	dueCount: number;
	/** Running total of dueCount up to and including this date */
	cumulative: number;
	/** Breakdown by card maturity */
	breakdown: {
		/** Review cards with interval < 21 days */
		young: number;
		/** Review cards with interval >= 21 days */
		mature: number;
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
		includeSourceUids?: ReadonlySet<string>,
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
					(!excludeSourceUids || !excludeSourceUids.has(c.sourceUid ?? "")) &&
					(!includeSourceUids || includeSourceUids.has(c.sourceUid ?? "")),
			);

		// Build forecast by date
		const forecast = new Map<
			string,
			{ young: number; mature: number; learning: number }
		>();

		const currentDate = new Date(today);
		while (currentDate <= endDate) {
			forecast.set(formatLocalDate(currentDate), {
				young: 0,
				mature: 0,
				learning: 0,
			});
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Count cards by date and maturity
		for (const card of cards) {
			const dateStr = formatLocalDate(new Date(card.due));
			const existing = forecast.get(dateStr);

			if (existing) {
				// State.New = 0 (not counted in forecast)
				// State.Review = 2 → split young/mature by interval
				// State.Learning = 1, State.Relearning = 3
				if (card.state === State.Review) {
					if (card.scheduledDays < MATURE_INTERVAL_DAYS) existing.young++;
					else existing.mature++;
				} else if (isLearningState(card.state)) {
					existing.learning++;
				}
			}
		}

		return toEntries(forecast);
	}

	/**
	 * Get summary statistics for the forecast
	 */
	getSummary(
		targetPerDay: number,
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
		maxDeviation: number = 20,
		includeSourceUids?: ReadonlySet<string>,
	): WorkloadForecastSummary {
		const forecast = this.getForecast(
			days,
			excludeSourceUids,
			includeSourceUids,
		);

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
		const empty: WorkloadForecastEntry = {
			date: "",
			dueCount: 0,
			cumulative: 0,
			breakdown: { young: 0, mature: 0, learning: 0 },
		};
		let peakDay = forecast[0] ?? empty;
		let minDay = forecast[0] ?? empty;
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

	/**
	 * Get cumulative workload (total reviews needed by each date)
	 */
	getCumulativeForecast(
		days: number = 30,
	): { date: string; cumulative: number }[] {
		return this.getForecast(days).map((entry) => ({
			date: entry.date,
			cumulative: entry.cumulative,
		}));
	}

	/**
	 * Get workload by day of week
	 */
	getWorkloadByDayOfWeek(
		days: number = 30,
		excludeSourceUids?: ReadonlySet<string>,
		includeSourceUids?: ReadonlySet<string>,
	): { day: number; dayName: string; avgCount: number }[] {
		const forecast = this.getForecast(
			days,
			excludeSourceUids,
			includeSourceUids,
		);

		// Group by day of week
		const byDay = new Map<number, number[]>();
		for (let i = 0; i < 7; i++) {
			byDay.set(i, []);
		}

		for (const entry of forecast) {
			// entry.date is a date-only string parsed as UTC midnight, so the
			// weekday must be read in UTC — getDay() shifts it west of UTC.
			const dayOfWeek = new Date(entry.date).getUTCDay();
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
