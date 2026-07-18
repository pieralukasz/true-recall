/**
 * Load Balance Service
 *
 * Distributes reviews evenly across days to prevent workload spikes.
 */

import { State } from "ts-fsrs";

import { isEasyDay } from "./easy-days.service";
import {
	constrainedFuzzBounds,
	hashString,
	mulberry32,
	selectWeightedDay,
	type WeightedDay,
} from "./fuzz";
import type {
	BalanceDueOptions,
	BalanceDueResult,
	CardDueInfo,
	CardScheduleChange,
	LoadBalanceOptions,
	SchedulerCardStore,
	SchedulingResult,
	WorkloadDistribution,
} from "./scheduler.types";

/** Range start that captures every overdue card regardless of age */
const OVERDUE_RANGE_START = "1970-01-01";

/** Horizon used to derive the automatic daily target from the real workload */
const AUTO_TARGET_WINDOW_DAYS = 30;

/** Anki: intervals beyond this are not worth balancing */
const MAX_LOAD_BALANCE_INTERVAL = 90;

/** Anki: near-zero weight that avoids zero-related corner cases */
const EASY_DAYS_MINIMUM_LOAD = 0.0001;

export class LoadBalanceService {
	constructor(private cardStore: SchedulerCardStore) {}

	/**
	 * Average daily workload over the next AUTO_TARGET_WINDOW_DAYS, backlog
	 * included, weighted so easy days count as a fraction of a normal day.
	 * Used as the target when no manual target is configured.
	 */
	computeAutoTarget(
		easyDays: NonNullable<LoadBalanceOptions["easyDays"]> = {
			recurringDays: [],
			specificDates: [],
		},
		easyDaysMultiplier = 0.5,
		includeOverdue = true,
	): number {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + AUTO_TARGET_WINDOW_DAYS);

		const todayStr = this.formatDate(today);
		const startDateStr = includeOverdue ? OVERDUE_RANGE_START : todayStr;
		const totalCards = this.cardStore
			.getDueCountsByDateRange(startDateStr, this.formatDate(endDate))
			.reduce((sum, entry) => sum + entry.count, 0);

		let weightedDays = 0;
		const cursor = new Date(today);
		while (cursor <= endDate) {
			weightedDays += isEasyDay(cursor, easyDays) ? easyDaysMultiplier : 1;
			cursor.setDate(cursor.getDate() + 1);
		}

		return Math.max(1, Math.round(totalCards / Math.max(1, weightedDays)));
	}

	/** Overdue Review cards: due strictly before today's UTC day key */
	getBacklogSize(): number {
		return this.cardStore
			.getDueCountsByDateRange(OVERDUE_RANGE_START, this.dateFromToday(-1))
			.reduce((sum, entry) => sum + entry.count, 0);
	}

	balance(options: LoadBalanceOptions): SchedulingResult {
		const {
			maxDeviation,
			days = 30,
			easyDays = { recurringDays: [], specificDates: [] },
			easyDaysMultiplier = 0.5,
			includeOverdue = true,
			cardIds,
			completedToday = 0,
			dryRun = true,
		} = options;
		const targetPerDay =
			options.targetPerDay ??
			this.computeAutoTarget(easyDays, easyDaysMultiplier, includeOverdue);
		const movable = cardIds ? new Set(cardIds) : null;

		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const todayStr = this.formatDate(today);
		const startDateStr = includeOverdue ? OVERDUE_RANGE_START : todayStr;
		const endDateStr = this.formatDate(endDate);

		const dueCards = this.getReviewCards(startDateStr, endDateStr);

		// Build distribution map. Overdue cards cannot be reviewed earlier than
		// today, so they count toward today's bucket — an accumulated backlog
		// becomes an overloaded "today" and is spread forward like any spike.
		const distribution = new Map<string, CardDueInfo[]>();
		for (const card of dueCards) {
			const dueDateStr = this.formatDate(new Date(card.due));
			const dateStr = dueDateStr < todayStr ? todayStr : dueDateStr;
			const existing = distribution.get(dateStr) ?? [];
			existing.push(card);
			distribution.set(dateStr, existing);
		}

		// Calculate target for each day (considering easy days)
		const dailyTargets = new Map<string, number>();
		const currentDate = new Date(today);
		while (currentDate <= endDate) {
			const dateStr = this.formatDate(currentDate);
			const isEasy = isEasyDay(currentDate, easyDays);
			let target = isEasy
				? Math.round(targetPerDay * easyDaysMultiplier)
				: targetPerDay;
			// Reviews already done today count toward today's workload — only
			// the remaining capacity is available for the backlog spread.
			if (dateStr === todayStr) {
				target = Math.max(0, target - completedToday);
			}
			dailyTargets.set(dateStr, target);
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Record before distribution
		const beforeDistribution: WorkloadDistribution[] = [];
		for (const [date, cards] of distribution) {
			beforeDistribution.push({ date, count: cards.length });
		}
		beforeDistribution.sort((a, b) => a.date.localeCompare(b.date));

		// Balance algorithm
		const changes: CardScheduleChange[] = [];
		const maxDev = targetPerDay * (maxDeviation / 100);

		// Find overloaded days and redistribute
		for (const [date, cards] of distribution) {
			const target = dailyTargets.get(date) ?? targetPerDay;
			const threshold = target + maxDev;

			if (cards.length > threshold) {
				// Move the cards that tolerate a shift best: longest scheduled
				// interval first, so short-interval (fragile) cards keep their day.
				const byInterval = [...cards].sort(
					(a, b) => a.scheduledDays - b.scheduledDays,
				);
				// Hysteresis: act only above threshold (target + deviation) but
				// trim down to the target itself, so the deviation band stays
				// free as slack — a day packed right at the ceiling would flag
				// "needs balancing" again as soon as the average drifts down.
				// With a movable subset, day capacity still counts every card but
				// only subset cards may leave — move at most the day's excess.
				const excessCount = cards.length - Math.floor(target);
				const candidates = movable
					? byInterval.filter((card) => movable.has(card.id))
					: byInterval;
				const excess = candidates.slice(
					Math.max(0, candidates.length - excessCount),
				);

				for (const card of excess) {
					// Find best day to move to
					const newDate = this.findBestDay(
						date,
						distribution,
						dailyTargets,
						targetPerDay,
						days,
					);

					if (newDate && newDate !== date) {
						const change: CardScheduleChange = {
							cardId: card.id,
							originalDue: card.due,
							newDue: `${newDate}T${card.due.split("T")[1]}`,
							daysChanged: this.daysDiff(date, newDate),
						};
						changes.push(change);

						const fromCards = distribution.get(date) ?? [];
						const idx = fromCards.findIndex((c) => c.id === card.id);
						if (idx >= 0) fromCards.splice(idx, 1);

						const toCards = distribution.get(newDate) ?? [];
						toCards.push({
							...card,
							due: change.newDue,
						});
						distribution.set(newDate, toCards);
					}
				}
			}
		}

		// Apply changes if not dry run
		if (!dryRun) {
			for (const change of changes) {
				this.cardStore.updateCardDue(change.cardId, change.newDue);
			}
		}

		// Build after distribution
		const afterDistribution: WorkloadDistribution[] = [];
		for (const [date, cards] of distribution) {
			afterDistribution.push({ date, count: cards.length });
		}
		afterDistribution.sort((a, b) => a.date.localeCompare(b.date));

		return {
			affectedCount: changes.length,
			beforeDistribution,
			afterDistribution,
			changes,
		};
	}

	/**
	 * Per-review balancing, ported from Anki's load_balancer.rs: pick a day
	 * within the interval's fuzz range by weighted random, preferring days
	 * with fewer due cards and slightly earlier days, avoiding siblings and
	 * respecting easy days. Deterministic per (card, target day) so the
	 * rating-button preview matches the actual grade.
	 */
	balanceDue(options: BalanceDueOptions): BalanceDueResult {
		const {
			cardId,
			originalDue,
			maxShiftDays,
			easyDays = { recurringDays: [], specificDates: [] },
			easyDaysMultiplier = 0.5,
		} = options;

		const unbalanced: BalanceDueResult = {
			originalDue,
			newDue: originalDue,
			daysChanged: 0,
			balanced: false,
		};
		if (maxShiftDays <= 0) return unbalanced;

		const todayStr = this.formatDate(new Date());
		const originalDayStr = this.formatDate(new Date(originalDue));
		const interval = this.daysDiff(todayStr, originalDayStr);

		// Anki: intervals under 2.5 days get no fuzz, far-out ones no balancing
		if (interval < 2.5 || interval > MAX_LOAD_BALANCE_INTERVAL) {
			return unbalanced;
		}

		const [fuzzLower, fuzzUpper] = constrainedFuzzBounds(
			interval,
			1,
			interval + maxShiftDays,
		);
		const lower = Math.max(fuzzLower, interval - maxShiftDays, 1);
		const upper = fuzzUpper;
		if (upper <= lower) return unbalanced;

		const countsByOffset = this.collectWindowCounts(
			cardId,
			todayStr,
			lower,
			upper,
		);

		const offsets: number[] = [];
		for (let offset = lower; offset <= upper; offset++) offsets.push(offset);
		const counts = offsets.map((offset) => countsByOffset.get(offset) ?? 0);
		const easyModifiers = this.calculateEasyDaysModifiers(
			offsets,
			counts,
			easyDays,
			easyDaysMultiplier,
		);

		const weightedDays: WeightedDay[] = offsets.map((offset, i) => {
			const count = counts[i] ?? 0;
			// Anki: an empty day gets full weight, bypassing all modifiers
			if (count === 0) return { day: offset, weight: 1.0 };

			const countWeight = (1 / count) ** 2.15;
			const intervalWeight = (1 / offset) ** 3;
			const weight =
				countWeight * intervalWeight * (easyModifiers[i] ?? 1.0);
			return { day: offset, weight };
		});

		const random = mulberry32(hashString(`${cardId}:${originalDayStr}`));
		const selected = selectWeightedDay(weightedDays, random);
		if (selected === null || selected === interval) return unbalanced;

		const newDue = this.withDate(originalDue, this.dateFromToday(selected));
		return {
			originalDue,
			newDue,
			daysChanged: selected - interval,
			balanced: true,
		};
	}

	/**
	 * Due counts per day-offset for the candidate window, via the aggregate
	 * query (no row materialization) so grading stays fast on large vaults.
	 */
	private collectWindowCounts(
		cardId: string,
		todayStr: string,
		lower: number,
		upper: number,
	): Map<number, number> {
		const counts = this.cardStore.getDueCountsByDateRange(
			this.dateFromToday(lower),
			this.dateFromToday(upper),
			cardId,
		);
		const countsByOffset = new Map<number, number>();
		for (const { day, count } of counts) {
			countsByOffset.set(this.daysDiff(todayStr, day), count);
		}
		return countsByOffset;
	}

	/**
	 * Anki's easy-days gate generalized to a single multiplier m: normal days
	 * stay on (1.0); easy days turn off (near-zero) when m is 0, or when the
	 * day's m-normalized count exceeds its proportional share of the window.
	 */
	private calculateEasyDaysModifiers(
		offsets: number[],
		counts: number[],
		easyDays: NonNullable<LoadBalanceOptions["easyDays"]>,
		multiplier: number,
	): number[] {
		const isEasy = offsets.map((offset) =>
			isEasyDay(new Date(this.dateFromToday(offset)), easyDays),
		);
		if (!isEasy.some(Boolean) || multiplier >= 1) {
			return offsets.map(() => 1.0);
		}

		const totalCount = counts.reduce((sum, c) => sum + c, 0);
		const totalPercents = isEasy.reduce(
			(sum, easy) => sum + (easy ? multiplier : 1),
			0,
		);

		return offsets.map((_offset, i) => {
			if (!isEasy[i]) return 1.0;
			if (multiplier <= EASY_DAYS_MINIMUM_LOAD) return EASY_DAYS_MINIMUM_LOAD;

			const count = counts[i] ?? 0;
			const otherDaysTotal = totalCount - count;
			const otherPercents = totalPercents - multiplier;
			if (otherPercents <= 0) return 1.0;

			const normalizedCount = count / multiplier;
			const reducedDayThreshold = otherDaysTotal / otherPercents;
			return normalizedCount > reducedDayThreshold
				? EASY_DAYS_MINIMUM_LOAD
				: 1.0;
		});
	}

	private dateFromToday(offset: number): string {
		const date = new Date();
		date.setDate(date.getDate() + offset);
		return this.formatDate(date);
	}

	private findBestDay(
		fromDate: string,
		distribution: Map<string, CardDueInfo[]>,
		targets: Map<string, number>,
		defaultTarget: number,
		maxDays: number,
	): string | null {
		let bestDate: string | null = null;
		let bestScore = Infinity;

		// Look for days with room (prefer later days to maintain spacing)
		const fromDateObj = new Date(fromDate);

		for (let offset = 1; offset <= maxDays; offset++) {
			const candidateDate = new Date(fromDateObj);
			candidateDate.setDate(candidateDate.getDate() + offset);
			const dateStr = this.formatDate(candidateDate);

			const currentCount = distribution.get(dateStr)?.length ?? 0;
			const target = targets.get(dateStr) ?? defaultTarget;

			// Destinations fill only up to the target — the deviation band is
			// tolerance for future drift, not extra capacity to pack into.
			if (currentCount < target) {
				// Calculate score (prefer closer dates and emptier days)
				const fillRatio = currentCount / target;
				const score = offset * 0.5 + fillRatio * 10;

				if (score < bestScore) {
					bestScore = score;
					bestDate = dateStr;
				}
			}

			// Distance alone puts every later day above the current best —
			// no candidate past this offset can win, so stop scanning.
			if (bestScore <= (offset + 1) * 0.5) break;
		}

		return bestDate;
	}

	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0] ?? "";
	}

	private withDate(originalDue: string, dateStr: string): string {
		return `${dateStr}T${originalDue.split("T")[1] ?? "00:00:00.000Z"}`;
	}

	/**
	 * Due cards in range, minus New-state cards: new cards are introduced by
	 * the daily new-card limit, not by due-date scheduling, so counting or
	 * moving them would distort the balance.
	 */
	private getReviewCards(startDate: string, endDate: string): CardDueInfo[] {
		return this.cardStore
			.getDueCardsByDateRange(startDate, endDate)
			.filter((card) => card.state !== State.New);
	}

	private daysDiff(from: string, to: string): number {
		const fromDate = new Date(from);
		const toDate = new Date(to);
		return Math.round(
			(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
		);
	}

	getDistribution(days: number): WorkloadDistribution[] {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const startDateStr = this.formatDate(today);
		const endDateStr = this.formatDate(endDate);

		const dueCards = this.cardStore.getDueCardsByDateRange(
			startDateStr,
			endDateStr,
		);

		// Build distribution map
		const distribution = new Map<string, number>();
		for (const card of dueCards) {
			const dateStr = this.formatDate(new Date(card.due));
			distribution.set(dateStr, (distribution.get(dateStr) ?? 0) + 1);
		}

		// Convert to array
		const result: WorkloadDistribution[] = [];
		const currentDate = new Date(today);
		while (currentDate <= endDate) {
			const dateStr = this.formatDate(currentDate);
			result.push({
				date: dateStr,
				count: distribution.get(dateStr) ?? 0,
			});
			currentDate.setDate(currentDate.getDate() + 1);
		}

		return result;
	}
}
