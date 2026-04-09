/**
 * Card State Helpers
 * Shared utilities for filtering and counting cards by FSRS state
 */

import { State } from "ts-fsrs";

import type { FSRSFlashcardItem } from "@true-recall/core/types";

/** Learning or Relearning */
export function isLearningState(state: State | number): boolean {
	return state === State.Learning || state === State.Relearning;
}

export function isNewState(state: State | number): boolean {
	return state === State.New;
}

export function isReviewState(state: State | number): boolean {
	return state === State.Review;
}

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
 * Check whether a card is active (not suspended, not currently buried).
 * Works with any data shape — pass the individual fields.
 */
export function isCardActive(
	suspended: boolean | undefined,
	buriedUntil: string | null | undefined,
	now?: Date,
): boolean {
	if (suspended) return false;
	if (buriedUntil) {
		if (new Date(buriedUntil) > (now ?? new Date())) return false;
	}
	return true;
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
 */
export function filterActiveCardsOnly<
	T extends { suspended?: boolean; buriedUntil?: string | null },
>(cards: T[], options: ActiveCardFilterOptions = {}): T[] {
	const now = options.now ?? new Date();
	return cards.filter((card) =>
		isCardActive(card.suspended, card.buriedUntil, now),
	);
}

/**
 * Count cards by FSRS state (New, Learning, Review)
 * Excludes suspended and buried cards
 */
export function countCardsByState(cards: FSRSFlashcardItem[]): CardStateCounts {
	const counts: CardStateCounts = { new: 0, learning: 0, review: 0 };
	const now = new Date();

	for (const card of cards) {
		if (!isCardActive(card.fsrs.suspended, card.fsrs.buriedUntil, now))
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
		if (!isCardActive(card.suspended, card.buriedUntil, now)) continue;

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
