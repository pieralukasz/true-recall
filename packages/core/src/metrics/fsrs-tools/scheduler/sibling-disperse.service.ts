/**
 * Sibling Disperse Service
 *
 * Spreads cards from the same source note to prevent seeing related content
 * too close together in time.
 */

import { State } from "ts-fsrs";

import type {
	CardScheduleChange,
	DisperseOptions,
	SchedulerCardStore,
	SchedulingResult,
	WorkloadDistribution,
} from "./scheduler.types";

/**
 * Sibling group for dispersion
 */
interface SiblingGroup {
	/** Source note UID */
	sourceUid: string;
	/** Cards in this group */
	cards: { id: string; due: string; scheduledDays: number }[];
}

/**
 * Sibling Disperse Service
 *
 * Cards from the same source note are "siblings". This service ensures
 * siblings are spaced apart by a minimum interval to avoid interference.
 */
export class SiblingDisperseService {
	constructor(private cardStore: SchedulerCardStore) {}

	/**
	 * Disperse sibling cards
	 */
	disperse(options: DisperseOptions): SchedulingResult {
		const { minInterval, sourceUid, dryRun = true } = options;

		const groups = sourceUid
			? [this.getSiblingGroup(sourceUid)]
			: this.getAllSiblingGroups();

		const changes: CardScheduleChange[] = [];
		const beforeDistribution = new Map<string, number>();
		const afterDistribution = new Map<string, number>();

		for (const group of groups) {
			if (!group || group.cards.length < 2) continue;

			// Sort cards by due date
			const sortedCards = [...group.cards].sort(
				(a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
			);

			// Track current due dates for before distribution
			for (const card of sortedCards) {
				const dateStr = this.formatDate(new Date(card.due));
				beforeDistribution.set(
					dateStr,
					(beforeDistribution.get(dateStr) ?? 0) + 1,
				);
			}

			// Disperse siblings
			const firstCard = sortedCards[0];
			if (!firstCard) continue;
			let previousDue = new Date(firstCard.due);
			afterDistribution.set(
				this.formatDate(previousDue),
				(afterDistribution.get(this.formatDate(previousDue)) ?? 0) + 1,
			);

			for (let i = 1; i < sortedCards.length; i++) {
				const card = sortedCards[i];
				if (!card) continue;
				const currentDue = new Date(card.due);
				const daysDiff = this.daysBetween(previousDue, currentDue);

				if (daysDiff < minInterval) {
					// Need to push this card forward
					const newDue = new Date(previousDue);
					newDue.setDate(newDue.getDate() + minInterval);

					const change: CardScheduleChange = {
						cardId: card.id,
						originalDue: card.due,
						newDue: newDue.toISOString(),
						daysChanged: minInterval - daysDiff,
					};
					changes.push(change);

					previousDue = newDue;
				} else {
					previousDue = currentDue;
				}

				afterDistribution.set(
					this.formatDate(previousDue),
					(afterDistribution.get(this.formatDate(previousDue)) ?? 0) + 1,
				);
			}
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
	 * Get sibling group for a specific source UID
	 */
	private getSiblingGroup(sourceUid: string): SiblingGroup | null {
		const cards = this.cardStore
			.getCards()
			.filter(
				(c) =>
					c.sourceUid === sourceUid && !c.suspended && c.state !== State.New,
			);

		if (cards.length === 0) return null;

		return {
			sourceUid,
			cards: cards.map((c) => ({
				id: c.id,
				due: c.due,
				scheduledDays: c.scheduledDays,
			})),
		};
	}

	/**
	 * Get all sibling groups (groups with more than 1 card)
	 */
	private getAllSiblingGroups(): SiblingGroup[] {
		const cards = this.cardStore
			.getCards()
			.filter((c) => c.sourceUid && !c.suspended && c.state !== State.New);

		// Group by source UID
		const groups = new Map<string, SiblingGroup>();
		for (const card of cards) {
			if (!card.sourceUid) continue;

			const existing = groups.get(card.sourceUid);
			if (existing) {
				existing.cards.push({
					id: card.id,
					due: card.due,
					scheduledDays: card.scheduledDays,
				});
			} else {
				groups.set(card.sourceUid, {
					sourceUid: card.sourceUid,
					cards: [
						{
							id: card.id,
							due: card.due,
							scheduledDays: card.scheduledDays,
						},
					],
				});
			}
		}

		return Array.from(groups.values()).filter((g) => g.cards.length > 1);
	}

	/**
	 * Find sibling pairs that violate the minimum interval
	 */
	findViolations(
		minInterval: number,
	): { sourceUid: string; cardCount: number; violations: number }[] {
		const groups = this.cardStore
			.getCards()
			.filter((c) => c.sourceUid && !c.suspended && c.state !== State.New);

		// Group by source UID
		const bySource = new Map<string, { id: string; due: string }[]>();
		for (const card of groups) {
			if (!card.sourceUid) continue;

			const existing = bySource.get(card.sourceUid) ?? [];
			existing.push({ id: card.id, due: card.due });
			bySource.set(card.sourceUid, existing);
		}

		// Check violations
		const results: {
			sourceUid: string;
			cardCount: number;
			violations: number;
		}[] = [];

		for (const [sourceUid, cards] of bySource) {
			if (cards.length < 2) continue;

			// Sort by due date
			cards.sort(
				(a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
			);

			let violations = 0;
			for (let i = 1; i < cards.length; i++) {
				const prevCard = cards[i - 1];
				const currCard = cards[i];
				if (!prevCard || !currCard) continue;
				const prev = new Date(prevCard.due);
				const curr = new Date(currCard.due);
				if (this.daysBetween(prev, curr) < minInterval) {
					violations++;
				}
			}

			if (violations > 0) {
				results.push({
					sourceUid,
					cardCount: cards.length,
					violations,
				});
			}
		}

		return results;
	}

	/**
	 * Calculate days between two dates
	 */
	private daysBetween(from: Date, to: Date): number {
		const diff = to.getTime() - from.getTime();
		return Math.floor(diff / (1000 * 60 * 60 * 24));
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
