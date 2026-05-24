/**
 * Load Balance Service
 *
 * Distributes reviews evenly across days to prevent workload spikes.
 */

import { isEasyDay } from "./easy-days.service";
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

export class LoadBalanceService {
	constructor(private cardStore: SchedulerCardStore) {}

	balance(options: LoadBalanceOptions): SchedulingResult {
		const {
			targetPerDay,
			maxDeviation,
			days = 30,
			easyDays = { recurringDays: [], specificDates: [] },
			easyDaysMultiplier = 0.5,
			dryRun = true,
		} = options;

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
		const distribution = new Map<string, CardDueInfo[]>();
		for (const card of dueCards) {
			const dateStr = this.formatDate(new Date(card.due));
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
			const target = isEasy
				? Math.round(targetPerDay * easyDaysMultiplier)
				: targetPerDay;
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
				// This day is overloaded - move excess cards
				const excess = cards.slice(Math.floor(threshold));

				for (const card of excess) {
					// Find best day to move to
					const newDate = this.findBestDay(
						date,
						distribution,
						dailyTargets,
						maxDev,
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

	balanceDue(options: BalanceDueOptions): BalanceDueResult {
		const {
			cardId,
			originalDue,
			targetPerDay,
			maxDeviation,
			maxShiftDays,
			easyDays = { recurringDays: [], specificDates: [] },
			easyDaysMultiplier = 0.5,
		} = options;

		if (maxShiftDays <= 0) {
			return {
				originalDue,
				newDue: originalDue,
				daysChanged: 0,
				balanced: false,
			};
		}

		const originalDate = new Date(originalDue);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const startDate = new Date(originalDate);
		startDate.setDate(startDate.getDate() - maxShiftDays);
		if (startDate < tomorrow) startDate.setTime(tomorrow.getTime());

		const endDate = new Date(originalDate);
		endDate.setDate(endDate.getDate() + maxShiftDays);

		if (startDate > endDate) {
			return {
				originalDue,
				newDue: originalDue,
				daysChanged: 0,
				balanced: false,
			};
		}

		const distribution = this.getDistributionMap(
			this.formatDate(startDate),
			this.formatDate(endDate),
			cardId,
		);
		const maxDev = targetPerDay * (maxDeviation / 100);
		const originalDateStr = this.formatDate(originalDate);

		if (
			this.hasRoom(
				originalDateStr,
				distribution,
				targetPerDay,
				maxDev,
				easyDays,
				easyDaysMultiplier,
			)
		) {
			return {
				originalDue,
				newDue: originalDue,
				daysChanged: 0,
				balanced: false,
			};
		}

		let bestDate: string | null = null;
		let bestScore = Infinity;

		const cursor = new Date(startDate);
		while (cursor <= endDate) {
			const dateStr = this.formatDate(cursor);
			const daysChanged = this.daysDiff(originalDateStr, dateStr);
			if (
				daysChanged !== 0 &&
				this.hasRoom(
					dateStr,
					distribution,
					targetPerDay,
					maxDev,
					easyDays,
					easyDaysMultiplier,
				)
			) {
				const target = this.getTargetForDate(
					cursor,
					targetPerDay,
					easyDays,
					easyDaysMultiplier,
				);
				const count = distribution.get(dateStr) ?? 0;
				const fillRatio = target > 0 ? count / target : count;
				const score = Math.abs(daysChanged) * 4 + fillRatio;
				if (score < bestScore) {
					bestScore = score;
					bestDate = dateStr;
				}
			}
			cursor.setDate(cursor.getDate() + 1);
		}

		if (!bestDate) {
			return {
				originalDue,
				newDue: originalDue,
				daysChanged: 0,
				balanced: false,
			};
		}

		const newDue = this.withDate(originalDue, bestDate);
		return {
			originalDue,
			newDue,
			daysChanged: this.daysDiff(originalDateStr, bestDate),
			balanced: true,
		};
	}

	private findBestDay(
		fromDate: string,
		distribution: Map<string, CardDueInfo[]>,
		targets: Map<string, number>,
		maxDev: number,
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
			const target = targets.get(dateStr) ?? 100;
			const threshold = target + maxDev;

			if (currentCount < threshold) {
				// Calculate score (prefer closer dates and emptier days)
				const fillRatio = currentCount / target;
				const score = offset * 0.5 + fillRatio * 10;

				if (score < bestScore) {
					bestScore = score;
					bestDate = dateStr;
				}
			}
		}

		return bestDate;
	}

	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0] ?? "";
	}

	private withDate(originalDue: string, dateStr: string): string {
		return `${dateStr}T${originalDue.split("T")[1] ?? "00:00:00.000Z"}`;
	}

	private getDistributionMap(
		startDate: string,
		endDate: string,
		excludeCardId?: string,
	): Map<string, number> {
		const cards = this.cardStore
			.getDueCardsByDateRange(startDate, endDate)
			.filter((card) => card.id !== excludeCardId);
		const distribution = new Map<string, number>();
		for (const card of cards) {
			const dateStr = this.formatDate(new Date(card.due));
			distribution.set(dateStr, (distribution.get(dateStr) ?? 0) + 1);
		}
		return distribution;
	}

	private getTargetForDate(
		date: Date,
		targetPerDay: number,
		easyDays: NonNullable<LoadBalanceOptions["easyDays"]>,
		easyDaysMultiplier: number,
	): number {
		return isEasyDay(date, easyDays)
			? Math.round(targetPerDay * easyDaysMultiplier)
			: targetPerDay;
	}

	private hasRoom(
		dateStr: string,
		distribution: Map<string, number>,
		targetPerDay: number,
		maxDev: number,
		easyDays: NonNullable<LoadBalanceOptions["easyDays"]>,
		easyDaysMultiplier: number,
	): boolean {
		const target = this.getTargetForDate(
			new Date(dateStr),
			targetPerDay,
			easyDays,
			easyDaysMultiplier,
		);
		const threshold = target + maxDev;
		return (distribution.get(dateStr) ?? 0) < threshold;
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
