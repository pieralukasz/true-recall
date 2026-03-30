/**
 * Easy Days Service
 *
 * Manages reduced workload on specific days (recurring weekdays + specific dates).
 */

import type {
	CardScheduleChange,
	SchedulerCardStore,
	SchedulingResult,
	WorkloadDistribution,
} from "./scheduler.types";
import type { EasyDaysConfig } from "../../../types";

export interface EasyDaysOptions {
	/** Easy days configuration (recurring weekdays + specific dates) */
	easyDays: EasyDaysConfig;
	/** Workload multiplier for easy days (0.0-1.0) */
	multiplier: number;
	/** Target daily reviews for normal days */
	targetPerDay: number;
	/** Number of days to process */
	days?: number;
	/** Dry run - don't apply changes */
	dryRun?: boolean;
}

export function isEasyDay(date: Date, easyDays: EasyDaysConfig): boolean {
	const dayOfWeek = date.getDay();
	const dateStr = date.toISOString().split("T")[0] ?? "";

	if (easyDays.recurringDays.includes(dayOfWeek)) {
		return true;
	}

	if (easyDays.specificDates.includes(dateStr)) {
		return true;
	}

	return false;
}

export class EasyDaysService {
	constructor(private cardStore: SchedulerCardStore) {}

	applyEasyDays(options: EasyDaysOptions): SchedulingResult {
		const {
			easyDays,
			multiplier,
			targetPerDay,
			days = 30,
			dryRun = true,
		} = options;

		const hasEasyDays =
			easyDays.recurringDays.length > 0 || easyDays.specificDates.length > 0;
		if (!hasEasyDays) {
			return {
				affectedCount: 0,
				beforeDistribution: [],
				afterDistribution: [],
				changes: [],
			};
		}

		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const startDateStr = this.formatDate(today);
		const endDateStr = this.formatDate(endDate);

		// Get all cards in range
		const cards = this.cardStore.getDueCardsByDateRange(
			startDateStr,
			endDateStr,
		);

		// Build distribution map
		const distribution = new Map<string, { id: string; due: string }[]>();
		for (const card of cards) {
			const dateStr = this.formatDate(new Date(card.due));
			const existing = distribution.get(dateStr) ?? [];
			existing.push({ id: card.id, due: card.due });
			distribution.set(dateStr, existing);
		}

		const changes: CardScheduleChange[] = [];
		const beforeDistribution = new Map<string, number>();
		const afterDistribution = new Map<string, number>();

		// Process each day
		const currentDate = new Date(today);
		while (currentDate <= endDate) {
			const dateStr = this.formatDate(currentDate);
			const isEasy = isEasyDay(currentDate, easyDays);

			const cardsOnDay = distribution.get(dateStr) ?? [];
			beforeDistribution.set(dateStr, cardsOnDay.length);

			if (isEasy && cardsOnDay.length > 0) {
				// Calculate max cards for this easy day
				const maxCards = Math.floor(targetPerDay * multiplier);

				if (cardsOnDay.length > maxCards) {
					// Need to move excess cards
					const excess = cardsOnDay.slice(maxCards);

					for (const card of excess) {
						// Find next non-easy day
						const targetDate = this.findNextNonEasyDay(
							currentDate,
							easyDays,
							days,
						);

						if (targetDate) {
							const targetDateStr = this.formatDate(targetDate);
							const newDue = new Date(card.due);
							newDue.setFullYear(targetDate.getFullYear());
							newDue.setMonth(targetDate.getMonth());
							newDue.setDate(targetDate.getDate());

							const change: CardScheduleChange = {
								cardId: card.id,
								originalDue: card.due,
								newDue: newDue.toISOString(),
								daysChanged: this.daysBetween(currentDate, targetDate),
							};
							changes.push(change);

							const targetCards = distribution.get(targetDateStr) ?? [];
							targetCards.push({ id: card.id, due: newDue.toISOString() });
							distribution.set(targetDateStr, targetCards);
						}
					}

					afterDistribution.set(dateStr, maxCards);
				} else {
					afterDistribution.set(dateStr, cardsOnDay.length);
				}
			} else {
				afterDistribution.set(dateStr, cardsOnDay.length);
			}

			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Apply changes if not dry run
		if (!dryRun) {
			for (const change of changes) {
				this.cardStore.updateCardDue(change.cardId, change.newDue);
			}
		}

		return {
			affectedCount: changes.length,
			beforeDistribution: this.mapToDistribution(beforeDistribution),
			afterDistribution: this.mapToDistribution(afterDistribution),
			changes,
		};
	}

	private findNextNonEasyDay(
		from: Date,
		easyDays: EasyDaysConfig,
		maxDays: number,
	): Date | null {
		const candidate = new Date(from);
		candidate.setDate(candidate.getDate() + 1);

		for (let i = 0; i < maxDays; i++) {
			if (!isEasyDay(candidate, easyDays)) {
				return candidate;
			}
			candidate.setDate(candidate.getDate() + 1);
		}

		return null;
	}

	previewImpact(
		easyDays: EasyDaysConfig,
		multiplier: number,
		targetPerDay: number,
		days: number = 30,
	): { totalMoved: number; byDay: { day: string; moved: number }[] } {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const startDateStr = this.formatDate(today);
		const endDateStr = this.formatDate(endDate);

		const cards = this.cardStore.getDueCardsByDateRange(
			startDateStr,
			endDateStr,
		);

		// Build distribution
		const distribution = new Map<string, number>();
		for (const card of cards) {
			const dateStr = this.formatDate(new Date(card.due));
			distribution.set(dateStr, (distribution.get(dateStr) ?? 0) + 1);
		}

		let totalMoved = 0;
		const byDay: { day: string; moved: number }[] = [];

		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const maxCards = Math.floor(targetPerDay * multiplier);

		for (const dayOfWeek of easyDays.recurringDays) {
			const dayName = dayNames[dayOfWeek] ?? "Unknown";
			let movedForDay = 0;

			const currentDate = new Date(today);
			while (currentDate <= endDate) {
				if (currentDate.getDay() === dayOfWeek) {
					const dateStr = this.formatDate(currentDate);
					const count = distribution.get(dateStr) ?? 0;
					const excess = Math.max(0, count - maxCards);
					movedForDay += excess;
				}
				currentDate.setDate(currentDate.getDate() + 1);
			}

			totalMoved += movedForDay;
			byDay.push({ day: dayName, moved: movedForDay });
		}

		for (const dateStr of easyDays.specificDates) {
			const count = distribution.get(dateStr) ?? 0;
			const excess = Math.max(0, count - maxCards);
			if (excess > 0) {
				totalMoved += excess;
				byDay.push({ day: dateStr, moved: excess });
			}
		}

		return { totalMoved, byDay };
	}

	private daysBetween(from: Date, to: Date): number {
		const diff = to.getTime() - from.getTime();
		return Math.round(diff / (1000 * 60 * 60 * 24));
	}

	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0] ?? "";
	}

	private mapToDistribution(map: Map<string, number>): WorkloadDistribution[] {
		return Array.from(map.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));
	}
}
