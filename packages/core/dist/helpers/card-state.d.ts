/**
 * Card State Helpers
 * Shared utilities for filtering and counting cards by FSRS state
 */
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "@true-recall/core/types";
/** Learning or Relearning */
export declare function isLearningState(state: State | number): boolean;
export declare function isNewState(state: State | number): boolean;
export declare function isReviewState(state: State | number): boolean;
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
export declare function isCardActive(suspended: boolean | undefined, buriedUntil: string | null | undefined, now?: Date): boolean;
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
export declare function filterActiveCardsOnly<T extends {
    suspended?: boolean;
    buriedUntil?: string | null;
}>(cards: T[], options?: ActiveCardFilterOptions): T[];
/**
 * Count cards by FSRS state (New, Learning, Review)
 * Excludes suspended and buried cards
 */
export declare function countCardsByState(cards: FSRSFlashcardItem[]): CardStateCounts;
/**
 * Count cards by state with due date filtering
 * Used for project-level statistics where "due" means review cards due before tomorrow
 */
export declare function countCardsByStateWithDue(cards: {
    state: State;
    due: string;
    suspended?: boolean;
    buriedUntil?: string | null;
}[], tomorrowBoundary: Date): CardStateCountsWithDue;
/**
 * Aggregate card state counts from multiple sources
 */
export declare function aggregateCardStateCounts(countsList: CardStateCounts[]): CardStateCounts;
