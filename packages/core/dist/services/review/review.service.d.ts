import { type Grade } from "ts-fsrs";
import type { FlashcardManager } from "../../flashcard/flashcard.service";
import type { CardSchedulingMeta, DailyStats, ReviewResult, ReviewSessionStats } from "../../types";
import type { FSRSSettings, NewCardOrder, NewReviewMix, ReviewOrder } from "../../types/settings.types";
import type { FSRSService } from "../fsrs/fsrs.service";
export interface QueueBuildOptions {
    newCardsLimit: number;
    reviewsLimit: number;
    reviewedToday?: Set<string>;
    newCardsStudiedToday?: number;
    /** Review-state cards already completed today (for per-day limit like Anki) */
    reviewsCompletedToday?: number;
    /** Filter to only cards with these source UIDs */
    sourceUidFilter?: Set<string>;
    newCardOrder?: NewCardOrder;
    reviewOrder?: ReviewOrder;
    newReviewMix?: NewReviewMix;
    sourceNoteFilter?: string;
    sourceNoteFilters?: string[];
    filePathFilter?: string;
    createdTodayOnly?: boolean;
    createdThisWeek?: boolean;
    /** stability < WEAK_CARD_STABILITY_THRESHOLD days */
    weakCardsOnly?: boolean;
    stateFilter?: "due" | "learning" | "new" | "buried";
    ignoreDailyLimits?: boolean;
    /** Show all matching cards regardless of due date (like Anki Custom Study) */
    bypassScheduling?: boolean;
    /** 0-23, default 4 like Anki */
    dayStartHour?: number;
    difficultyRange?: {
        min: number;
        max: number;
    };
    lapsesRange?: {
        min: number;
        max: number;
    };
    stabilityRange?: {
        min: number;
        max: number;
    };
    /** Only cards past their due date */
    overdueOnly?: boolean;
    /** Cards whose last review was rated Again */
    recentlyFailed?: boolean;
    /** Overall cap on session size */
    cardLimit?: number;
    /** Include cards due within the next N days (study ahead) */
    studyAheadDays?: number;
    /** Optional per-card preset assignment (global mode) */
    cardPresetById?: Map<string, string>;
    /** Optional daily limits per preset (global mode) */
    presetDailyLimits?: Map<string, {
        newCardsPerDay: number;
        reviewsPerDay: number;
    }>;
    /** Optional progress today per preset (global mode) */
    presetProgressToday?: Map<string, {
        newStudied: number;
        reviewsCompleted: number;
    }>;
    /** Fallback preset name for cards without explicit assignment */
    defaultPresetName?: string;
    /** When false, apply queue spacing instead of runtime sibling burying */
    burySiblings?: boolean;
}
export declare class ReviewService {
    /**
     * When burySiblings is off, spread IO/cloze siblings apart in the queue
     * so cards from the same note don't appear back-to-back.
     */
    spaceSiblings(queue: CardSchedulingMeta[]): CardSchedulingMeta[];
    /** Order (Anki-like): Due Learning -> Review -> New -> Pending Learning */
    buildQueue(allCards: CardSchedulingMeta[], fsrsService: FSRSService, options: QueueBuildOptions): CardSchedulingMeta[];
    processAnswer<T extends CardSchedulingMeta>(card: T, rating: Grade, fsrsService: FSRSService, responseTime: number, presetSettings?: FSRSSettings): {
        updatedCard: T;
        result: ReviewResult;
    };
    gradeCard<T extends CardSchedulingMeta>(card: T, rating: Grade, fsrsService: FSRSService, flashcardManager: FlashcardManager, responseTime?: number): {
        updatedCard: T;
        result: ReviewResult;
        persisted: boolean;
    };
    calculateSessionStats(results: ReviewResult[], totalCards: number, startTime: number): ReviewSessionStats;
    calculateDailyStats(allCards: CardSchedulingMeta[], todayResults: ReviewResult[], settings: {
        newCardsPerDay: number;
        reviewsPerDay: number;
        dayStartHour?: number;
    }, dayBoundaryService?: import("./day-boundary.service").DayBoundaryService): DailyStats;
    /**
     * Check if a card should be re-added to queue (for learning cards)
     * Learning/Relearning cards are ALWAYS requeued - the position is determined
     * by getRequeuePosition(). Cards due soon go near the front, cards due later
     * go at the end where getPhase() will trigger the waiting screen.
     */
    shouldRequeue(card: CardSchedulingMeta): boolean;
    getRequeuePosition(queue: CardSchedulingMeta[], startIndex: number, card: CardSchedulingMeta, reviewOrder?: ReviewOrder): number;
    calculateRetentionRate(results: ReviewResult[]): number;
    getStreakInfo(results: ReviewResult[], dayStartHour?: number): {
        currentStreak: number;
        longestStreak: number;
    };
}
