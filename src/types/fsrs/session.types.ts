/**
 * FSRS Session Types
 * Review session state and results
 */

import type { State, Grade } from "ts-fsrs";
import type { FSRSFlashcardItem } from "./card.types";

/**
 * Single review result
 */
export interface ReviewResult {
    /** Card ID */
    cardId: string;
    /** Rating: Again=1, Hard=2, Good=3, Easy=4 */
    rating: Grade;
    /** Review timestamp */
    timestamp: number;
    /** Response time in ms */
    responseTime: number;
    /** Card state before review */
    previousState: State;
    /** Scheduled days (before review) */
    scheduledDays: number;
    /** Actual days since last review */
    elapsedDays: number;
}

/**
 * Review history entry (for FSRS optimization)
 */
export interface ReviewHistoryEntry {
    cardId: string;
    rating: Grade;
    timestamp: number;
    scheduledDays: number;
    elapsedDays: number;
    state: State;
    stability: number;
    difficulty: number;
}

/**
 * Session statistics
 */
export interface ReviewSessionStats {
    /** Total cards in session */
    total: number;
    /** Cards reviewed */
    reviewed: number;
    /** "Again" responses */
    again: number;
    /** "Hard" responses */
    hard: number;
    /** "Good" responses */
    good: number;
    /** "Easy" responses */
    easy: number;
    /** New cards in session */
    newCards: number;
    /** Learning cards */
    learningCards: number;
    /** Review cards */
    reviewCards: number;
    /** Session duration in ms */
    duration: number;
}

/**
 * Review session state
 */
export interface ReviewSessionState {
    /** Is session active */
    isActive: boolean;
    /** Card queue */
    queue: FSRSFlashcardItem[];
    /** Current card index */
    currentIndex: number;
    /** Is answer revealed */
    isAnswerRevealed: boolean;
    /** Review results */
    results: ReviewResult[];
    /** Session start time */
    startTime: number;
    /** Question shown time (for response time calculation) */
    questionShownTime: number;
    /** Session statistics */
    stats: ReviewSessionStats;
}

/**
 * Default session state
 */
export function createDefaultSessionState(): ReviewSessionState {
    return {
        isActive: false,
        queue: [],
        currentIndex: 0,
        isAnswerRevealed: false,
        results: [],
        startTime: 0,
        questionShownTime: 0,
        stats: {
            total: 0,
            reviewed: 0,
            again: 0,
            hard: 0,
            good: 0,
            easy: 0,
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
            duration: 0,
        },
    };
}
