/**
 * Flatten Service
 *
 * Redistributes excess cards from overloaded days to nearby days.
 */

import type {
	SchedulerCardStore,
	FlattenOptions,
	SchedulingResult,
	CardScheduleChange,
	WorkloadDistribution,
} from "./scheduler.types";

/**
 * Flatten Service
 *
 * When a day exceeds the maximum card limit, excess cards are
 * moved to adjacent days to reduce the peak.
 */
export class FlattenService {
	constructor(private cardStore: SchedulerCardStore) {}

	/**
	 * Flatten a specific date by moving excess cards
	 */
	async flatten(options: FlattenOptions): Promise<SchedulingResult> {
		const { date, maxCards, dryRun = true } = options;

		// Get cards due on target date
		const nextDate = new Date(date);
		nextDate.setDate(nextDate.getDate() + 1);
		const nextDateStr = this.formatDate(nextDate);

		const cards = this.cardStore.getDueCardsByDateRange(date, nextDateStr);

		const changes: CardScheduleChange[] = [];
		const beforeDistribution = new Map<string, number>();
		const afterDistribution = new Map<string, number>();

		// Record before
		beforeDistribution.set(date, cards.length);

		if (cards.length <= maxCards) {
			// No flattening needed
			return {
				affectedCount: 0,
				beforeDistribution: [{ date, count: cards.length }],
				afterDistribution: [{ date, count: cards.length }],
				changes: [],
			};
		}

		// Sort cards by scheduled_days (move longer interval cards first)
		const sortedCards = [...cards].sort(
			(a, b) => b.scheduledDays - a.scheduledDays
		);

		// Keep maxCards, redistribute the rest
		const toKeep = sortedCards.slice(0, maxCards);
		const toMove = sortedCards.slice(maxCards);

		afterDistribution.set(date, toKeep.length);

		// Distribute excess cards to following days
		let offset = 1;
		for (const card of toMove) {
			const targetDate = new Date(date);
			targetDate.setDate(targetDate.getDate() + offset);
			const targetDateStr = this.formatDate(targetDate);

			// Check if target day is full
			const targetCount = afterDistribution.get(targetDateStr) ?? 0;
			if (targetCount >= maxCards) {
				offset++;
				// Recalculate target date
				targetDate.setDate(new Date(date).getDate() + offset);
			}

			const newDue = new Date(card.due);
			newDue.setDate(newDue.getDate() + offset);

			const change: CardScheduleChange = {
				cardId: card.id,
				originalDue: card.due,
				newDue: newDue.toISOString(),
				daysChanged: offset,
			};
			changes.push(change);

			// Update tracking
			afterDistribution.set(
				this.formatDate(newDue),
				(afterDistribution.get(this.formatDate(newDue)) ?? 0) + 1
			);
		}

		// Apply changes if not dry run
		if (!dryRun) {
			for (const change of changes) {
				await this.cardStore.updateCardDue(change.cardId, change.newDue);
			}
		}

		return {
			affectedCount: changes.length,
			beforeDistribution: this.mapToDistribution(beforeDistribution),
			afterDistribution: this.mapToDistribution(afterDistribution),
			changes,
		};
	}

	/**
	 * Find days that exceed the limit
	 */
	findOverloadedDays(
		maxCards: number,
		days: number = 30
	): { date: string; count: number; excess: number }[] {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const distribution = this.cardStore.getDueCardsByDateRange(
			this.formatDate(today),
			this.formatDate(endDate)
		);

		// Group by date
		const byDate = new Map<string, number>();
		for (const card of distribution) {
			const dateStr = this.formatDate(new Date(card.due));
			byDate.set(dateStr, (byDate.get(dateStr) ?? 0) + 1);
		}

		// Find overloaded days
		const overloaded: { date: string; count: number; excess: number }[] = [];
		for (const [date, count] of byDate) {
			if (count > maxCards) {
				overloaded.push({
					date,
					count,
					excess: count - maxCards,
				});
			}
		}

		return overloaded.sort((a, b) => a.date.localeCompare(b.date));
	}

	/**
	 * Format date as YYYY-MM-DD
	 */
	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0]!;
	}

	/**
	 * Convert distribution map to array
	 */
	private mapToDistribution(
		map: Map<string, number>
	): WorkloadDistribution[] {
		return Array.from(map.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));
	}
}
