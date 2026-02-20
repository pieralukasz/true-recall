/**
 * Card State Helpers
 * Shared utilities for filtering and counting cards by FSRS state
 */
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../types";

/**
 * Card state counts (FSRS states)
 */
export interface CardStateCounts {
	new: number;
	learning: number;
	review: number;
}

/**
 * Extended card counts with due information
 */
export interface CardStateCountsWithDue extends CardStateCounts {
	due: number;
}

/**
 * Options for filtering active cards
 */
export interface ActiveCardFilterOptions {
	/** Current timestamp (defaults to new Date()) */
	now?: Date;
}

/**
 * Filter out suspended and buried cards
 * Returns only cards that are currently active (not suspended, not buried)
 *
 * @param cards Cards to filter
 * @param options Filter options
 * @returns Active cards only
 */
export function filterActiveCardsOnly<
	T extends { suspended?: boolean; buriedUntil?: string | null },
>(cards: T[], options: ActiveCardFilterOptions = {}): T[] {
	const now = options.now ?? new Date();

	return cards.filter((card) => {
		// Skip suspended cards
		if (card.suspended) return false;

		// Skip buried cards (if buriedUntil is in the future)
		if (card.buriedUntil) {
			const buriedUntil = new Date(card.buriedUntil);
			if (buriedUntil > now) return false;
		}

		return true;
	});
}

/**
 * Count cards by FSRS state (New, Learning, Review)
 * Excludes suspended and buried cards
 *
 * @param cards Cards to count (already filtered for active)
 * @returns Counts by state
 */
export function countCardsByState(cards: FSRSFlashcardItem[]): CardStateCounts {
	const counts: CardStateCounts = { new: 0, learning: 0, review: 0 };
	const now = new Date();

	for (const card of cards) {
		// Skip buried/suspended cards
		if (card.fsrs.suspended) continue;
		if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
			continue;

		switch (card.fsrs.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review:
				counts.review++;
				break;
		}
	}

	return counts;
}

/**
 * Count cards by state with due date filtering
 * Used for project-level statistics where "due" means review cards due before tomorrow
 *
 * @param cards Cards to count (raw cards with FSRS data)
 * @param tomorrowBoundary Tomorrow boundary date for due calculation
 * @returns Counts by state including due count
 */
export function countCardsByStateWithDue(
	cards: {
		state: State;
		due: string;
		suspended?: boolean;
		buriedUntil?: string | null;
	}[],
	tomorrowBoundary: Date,
): CardStateCountsWithDue {
	const counts: CardStateCountsWithDue = {
		new: 0,
		learning: 0,
		review: 0,
		due: 0,
	};
	const now = new Date();

	for (const card of cards) {
		// Skip suspended cards
		if (card.suspended) continue;

		// Skip buried cards
		if (card.buriedUntil) {
			const buriedUntil = new Date(card.buriedUntil);
			if (buriedUntil > now) continue;
		}

		const dueDate = new Date(card.due);

		switch (card.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review:
				counts.review++;
				// Due count: Review cards due before tomorrow boundary
				if (dueDate < tomorrowBoundary) {
					counts.due++;
				}
				break;
		}
	}

	return counts;
}

/**
 * Aggregate card state counts from multiple sources
 *
 * @param countsList List of card state counts to aggregate
 * @returns Aggregated counts
 */
export function aggregateCardStateCounts(
	countsList: CardStateCounts[],
): CardStateCounts {
	return countsList.reduce(
		(acc, counts) => ({
			new: acc.new + counts.new,
			learning: acc.learning + counts.learning,
			review: acc.review + counts.review,
		}),
		{ new: 0, learning: 0, review: 0 },
	);
}
