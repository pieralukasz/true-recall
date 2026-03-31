/**
 * Card State Helpers
 * Shared utilities for filtering and counting cards by FSRS state
 */
import type { FSRSFlashcardItem } from "@true-recall/core/types";
import { State } from "ts-fsrs";
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
