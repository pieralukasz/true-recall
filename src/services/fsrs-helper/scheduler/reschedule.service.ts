/**
 * Reschedule Service
 *
 * Recalculates all card intervals based on current FSRS weights.
 * Useful after parameter optimization to apply new weights to existing cards.
 */

import { State } from "ts-fsrs";
import type { FSRSSettings } from "../../../types";
import type {
	SchedulerCardStore,
	RescheduleOptions,
	SchedulingResult,
	CardScheduleChange,
	WorkloadDistribution,
} from "./scheduler.types";

/**
 * Reschedule Service
 *
 * After optimizing FSRS parameters, this service recalculates all card
 * intervals to use the new weights, maintaining the cards' stability
 * and difficulty values.
 */
export class RescheduleService {
	constructor(
		private cardStore: SchedulerCardStore,
		private fsrsSettings: FSRSSettings
	) {}

	/**
	 * Reschedule cards based on current FSRS weights
	 */
	async reschedule(options: RescheduleOptions): Promise<SchedulingResult> {
		const { scope, cardIds, dryRun = true } = options;

		// Get cards to reschedule based on scope
		const cards = await this.getCardsForScope(scope, cardIds);

		const changes: CardScheduleChange[] = [];
		const beforeDistribution = new Map<string, number>();
		const afterDistribution = new Map<string, number>();

		for (const card of cards) {
			// Skip new cards (they don't have scheduling yet)
			if (card.state === (State.New as number)) continue;

			// Record before
			const beforeDateStr = this.formatDate(new Date(card.due));
			beforeDistribution.set(
				beforeDateStr,
				(beforeDistribution.get(beforeDateStr) ?? 0) + 1
			);

			// Calculate new interval based on current stability
			// The retrievability formula: R = e^(-t/S * ln(9))
			// For target retention r, solve for t: t = S * ln(9) / ln(1/r)
			const targetRetention = this.fsrsSettings.requestRetention;
			const stability = card.stability;

			// Calculate new interval
			const newInterval = Math.round(
				stability * Math.log(9) / Math.log(1 / targetRetention)
			);

			// Calculate new due date from last review
			const lastReview = card.lastReview
				? new Date(card.lastReview)
				: new Date();
			const newDue = new Date(lastReview);
			newDue.setDate(newDue.getDate() + Math.max(1, newInterval));

			// Cap at maximum interval
			const maxDue = new Date(lastReview);
			maxDue.setDate(maxDue.getDate() + this.fsrsSettings.maximumInterval);
			if (newDue > maxDue) {
				newDue.setTime(maxDue.getTime());
			}

			const afterDateStr = this.formatDate(newDue);
			afterDistribution.set(
				afterDateStr,
				(afterDistribution.get(afterDateStr) ?? 0) + 1
			);

			// Only record if there's a change
			const originalDueMs = new Date(card.due).getTime();
			const newDueMs = newDue.getTime();

			if (Math.abs(originalDueMs - newDueMs) > 86400000) {
				// More than 1 day difference
				const change: CardScheduleChange = {
					cardId: card.id,
					originalDue: card.due,
					newDue: newDue.toISOString(),
					daysChanged: this.daysBetween(new Date(card.due), newDue),
				};
				changes.push(change);
			}
		}

		// Apply changes if not dry run
		if (!dryRun) {
			for (const change of changes) {
				await this.cardStore.updateCardScheduling(change.cardId, {
					due: change.newDue,
					scheduledDays: Math.max(1, Math.abs(change.daysChanged)),
				});
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
	 * Get cards based on scope
	 */
	private async getCardsForScope(
		scope: RescheduleOptions["scope"],
		cardIds?: string[]
	): Promise<
		{
			id: string;
			due: string;
			state: number;
			stability: number;
			lastReview: string | null;
		}[]
	> {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		switch (scope) {
			case "selected":
				if (!cardIds || cardIds.length === 0) return [];
				return cardIds
					.map((id) => {
						const card = this.cardStore.get(id);
						return card
							? {
									id: card.id,
									due: card.due,
									state: card.state,
									stability: card.stability,
									lastReview: card.lastReview,
								}
							: null;
					})
					.filter(
						(
							c
						): c is {
							id: string;
							due: string;
							state: number;
							stability: number;
							lastReview: string | null;
						} => c !== null
					);

			case "due": {
				const allCards = this.cardStore.getCards();
				return allCards
					.filter(
						(c) =>
							new Date(c.due) <= today &&
							!c.suspended &&
							c.state !== State.New
					)
					.map((c) => ({
						id: c.id,
						due: c.due,
						state: c.state,
						stability: c.stability,
						lastReview: c.lastReview,
					}));
			}

			case "overdue": {
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);
				const allCards = this.cardStore.getCards();
				return allCards
					.filter(
						(c) =>
							new Date(c.due) < today &&
							!c.suspended &&
							c.state !== State.New
					)
					.map((c) => ({
						id: c.id,
						due: c.due,
						state: c.state,
						stability: c.stability,
						lastReview: c.lastReview,
					}));
			}

			case "all":
			default: {
				const allCards = this.cardStore.getCards();
				return allCards
					.filter((c) => !c.suspended && c.state !== State.New)
					.map((c) => ({
						id: c.id,
						due: c.due,
						state: c.state,
						stability: c.stability,
						lastReview: c.lastReview,
					}));
			}
		}
	}

	/**
	 * Calculate days between two dates
	 */
	private daysBetween(from: Date, to: Date): number {
		const diff = to.getTime() - from.getTime();
		return Math.round(diff / (1000 * 60 * 60 * 24));
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
