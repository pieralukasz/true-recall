/**
 * Reschedule Service
 *
 * Recalculates all card intervals based on current FSRS weights.
 * Useful after parameter optimization to apply new weights to existing cards.
 */

import type {
	CardScheduleChange,
	RescheduleOptions,
	SchedulerCardStore,
	SchedulingResult,
	WorkloadDistribution,
} from "./scheduler.types";
import { DEFAULT_FSRS_WEIGHTS } from "../../../constants";
import type { FSRSSettings } from "../../../types";
import { FSRS, State } from "ts-fsrs";

export class RescheduleService {
	private fsrs: FSRS;

	constructor(
		private cardStore: SchedulerCardStore,
		fsrsSettings: FSRSSettings,
	) {
		this.fsrs = new FSRS({
			request_retention: fsrsSettings.requestRetention,
			maximum_interval: fsrsSettings.maximumInterval,
			w: fsrsSettings.weights ?? DEFAULT_FSRS_WEIGHTS,
			enable_fuzz: false, // No fuzz for rescheduling — deterministic intervals
		});
	}

	/**
	 * Reschedule cards based on current FSRS weights
	 */
	reschedule(options: RescheduleOptions): SchedulingResult {
		const { scope, cardIds, dryRun = true } = options;

		const cards = this.getCardsForScope(scope, cardIds);

		const changes: CardScheduleChange[] = [];
		const beforeDistribution = new Map<string, number>();
		const afterDistribution = new Map<string, number>();

		for (const card of cards) {
			// Skip New and Learning/Relearning cards — only Review cards use stability-based intervals
			if (
				card.state === (State.New as number) ||
				card.state === (State.Learning as number) ||
				card.state === (State.Relearning as number)
			)
				continue;

			// Record before
			const beforeDateStr = this.formatDate(new Date(card.due));
			beforeDistribution.set(
				beforeDateStr,
				(beforeDistribution.get(beforeDateStr) ?? 0) + 1,
			);

			const lastReview = card.lastReview
				? new Date(card.lastReview)
				: new Date();
			const elapsedDays = Math.max(
				0,
				Math.floor((Date.now() - lastReview.getTime()) / 86400000),
			);

			// Delegate to ts-fsrs which uses the correct FSRS-6 power-law formula
			// (includes interval_modifier, clamping to [1, maximumInterval], no fuzz)
			const newInterval = this.fsrs.next_interval(card.stability, elapsedDays);

			const newDue = new Date(lastReview);
			newDue.setDate(newDue.getDate() + newInterval);

			const afterDateStr = this.formatDate(newDue);
			afterDistribution.set(
				afterDateStr,
				(afterDistribution.get(afterDateStr) ?? 0) + 1,
			);

			const originalDueMs = new Date(card.due).getTime();
			const newDueMs = newDue.getTime();

			if (Math.abs(originalDueMs - newDueMs) > 86400000) {
				const change: CardScheduleChange = {
					cardId: card.id,
					originalDue: card.due,
					newDue: newDue.toISOString(),
					daysChanged: this.daysBetween(new Date(card.due), newDue),
				};
				changes.push(change);
			}
		}

		if (!dryRun) {
			for (const change of changes) {
				const lastReview = cards.find(
					(c) => c.id === change.cardId,
				)?.lastReview;
				const reviewDate = lastReview ? new Date(lastReview) : new Date();
				const scheduledDays = Math.max(
					1,
					this.daysBetween(reviewDate, new Date(change.newDue)),
				);

				this.cardStore.updateCardScheduling(change.cardId, {
					due: change.newDue,
					scheduledDays,
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
	private getCardsForScope(
		scope: RescheduleOptions["scope"],
		cardIds?: string[],
	): {
		id: string;
		due: string;
		state: number;
		stability: number;
		lastReview: string | null;
	}[] {
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
							c,
						): c is {
							id: string;
							due: string;
							state: number;
							stability: number;
							lastReview: string | null;
						} => c !== null,
					);

			case "due": {
				const allCards = this.cardStore.getCards();
				return allCards
					.filter(
						(c) =>
							new Date(c.due) <= today && !c.suspended && c.state !== State.New,
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
							new Date(c.due) < today && !c.suspended && c.state !== State.New,
					)
					.map((c) => ({
						id: c.id,
						due: c.due,
						state: c.state,
						stability: c.stability,
						lastReview: c.lastReview,
					}));
			}
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
