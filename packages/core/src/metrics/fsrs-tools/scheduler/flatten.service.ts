/**
 * Flatten Service
 *
 * Redistributes excess cards from overloaded days to nearby days.
 */

import type {
	CardDueInfo,
	CardScheduleChange,
	FlattenFutureOptions,
	FlattenOptions,
	SchedulerCardStore,
	SchedulingResult,
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
	flatten(options: FlattenOptions): SchedulingResult {
		const { date, maxCards, cardIds, dryRun = true } = options;

		const nextDate = new Date(date);
		nextDate.setDate(nextDate.getDate() + 1);
		const nextDateStr = this.formatDate(nextDate);

		let cards = this.cardStore.getDueCardsByDateRange(date, nextDateStr);
		if (cardIds) {
			const allowed = new Set(cardIds);
			cards = cards.filter((c) => allowed.has(c.id));
		}

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
			(a, b) => b.scheduledDays - a.scheduledDays,
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

			afterDistribution.set(
				this.formatDate(newDue),
				(afterDistribution.get(this.formatDate(newDue)) ?? 0) + 1,
			);
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

	/**
	 * Flatten all future days to a maximum number of reviews per day.
	 *
	 * Walks days chronologically; excess cards on each day (shortest
	 * intervals first, matching `flatten`) cascade to following days
	 * until every day is at or under the limit.
	 */
	flattenFuture(options: FlattenFutureOptions): SchedulingResult {
		const { maxCards, days = 365, cardIds, dryRun = true } = options;

		// maxCards < 1 would carry every card forward forever
		if (maxCards < 1) {
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

		let cards = this.cardStore.getDueCardsByDateRange(
			this.formatDate(today),
			this.formatDate(endDate),
		);
		if (cardIds) {
			const allowed = new Set(cardIds);
			cards = cards.filter((c) => allowed.has(c.id));
		}

		const byDate = new Map<string, CardDueInfo[]>();
		const beforeDistribution = new Map<string, number>();
		for (const card of cards) {
			const dateStr = this.formatDate(new Date(card.due));
			const bucket = byDate.get(dateStr);
			if (bucket) bucket.push(card);
			else byDate.set(dateStr, [card]);
			beforeDistribution.set(
				dateStr,
				(beforeDistribution.get(dateStr) ?? 0) + 1,
			);
		}

		const changes: CardScheduleChange[] = [];
		const afterDistribution = new Map<string, number>();
		const dates = [...byDate.keys()].sort();
		const firstDate = dates[0];
		const lastDate = dates[dates.length - 1];

		if (firstDate && lastDate) {
			const dayMs = 24 * 60 * 60 * 1000;
			const firstMs = Date.parse(firstDate);
			let carried: CardDueInfo[] = [];

			// Cascade can extend past lastDate; carried shrinks by at least
			// one card per day once source days are exhausted, so it ends.
			for (let offset = 0; ; offset++) {
				const cursor = new Date(firstMs + offset * dayMs);
				const dateStr = this.formatDate(cursor);
				const dayCards = byDate.get(dateStr) ?? [];
				if (dayCards.length === 0 && carried.length === 0) {
					if (dateStr > lastDate) break;
					continue;
				}

				// Keep longest intervals on their day, cascade shortest
				const pool = [...dayCards, ...carried].sort(
					(a, b) => b.scheduledDays - a.scheduledDays,
				);
				const keep = pool.slice(0, maxCards);
				carried = pool.slice(maxCards);
				afterDistribution.set(dateStr, keep.length);

				for (const card of keep) {
					const originalDateStr = this.formatDate(new Date(card.due));
					if (originalDateStr === dateStr) continue;

					const newDue = new Date(card.due);
					newDue.setFullYear(cursor.getFullYear());
					newDue.setMonth(cursor.getMonth());
					newDue.setDate(cursor.getDate());
					changes.push({
						cardId: card.id,
						originalDue: card.due,
						newDue: newDue.toISOString(),
						daysChanged: Math.round(
							(Date.parse(dateStr) - Date.parse(originalDateStr)) / dayMs,
						),
					});
				}
			}
		}

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

	/**
	 * Find days that exceed the limit
	 */
	findOverloadedDays(
		maxCards: number,
		days: number = 30,
	): { date: string; count: number; excess: number }[] {
		const today = new Date();
		const endDate = new Date(today);
		endDate.setDate(endDate.getDate() + days);

		const distribution = this.cardStore.getDueCardsByDateRange(
			this.formatDate(today),
			this.formatDate(endDate),
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
		return date.toISOString().split("T")[0] ?? "";
	}

	/**
	 * Convert distribution map to array
	 */
	private mapToDistribution(map: Map<string, number>): WorkloadDistribution[] {
		return Array.from(map.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));
	}
}
