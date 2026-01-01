/**
 * FSRS Service
 * Wrapper around ts-fsrs library for spaced repetition scheduling
 */
import {
    FSRS,
    createEmptyCard,
    Rating,
    State,
    type Card,
    type Grade,
    type RecordLogItem,
} from "ts-fsrs";
import type { FSRSSettings } from "../types/settings.types";
import type {
    FSRSCardData,
    FSRSFlashcardItem,
    SchedulingPreview,
} from "../types/fsrs.types";
import { formatInterval } from "../types/fsrs.types";
import { DEFAULT_FSRS_WEIGHTS } from "../constants";

/**
 * Service for FSRS scheduling calculations
 */
export class FSRSService {
    private fsrs: FSRS;
    private settings: FSRSSettings;

    constructor(settings: FSRSSettings) {
        this.settings = settings;
        this.fsrs = this.createFSRS(settings);
    }

    /**
     * Create FSRS instance with given settings
     */
    private createFSRS(settings: FSRSSettings): FSRS {
        // Convert minutes to step format (e.g., [1, 10] -> ["1m", "10m"])
        const learningSteps = settings.learningSteps.map(m => `${m}m` as const);
        const relearningSteps = settings.relearningSteps.map(m => `${m}m` as const);

        return new FSRS({
            request_retention: settings.requestRetention,
            maximum_interval: settings.maximumInterval,
            w: settings.weights ?? DEFAULT_FSRS_WEIGHTS,
            enable_short_term: settings.enableShortTerm,
            learning_steps: learningSteps,
            relearning_steps: relearningSteps,
            enable_fuzz: false,
        });
    }

    /**
     * Update FSRS settings
     */
    updateSettings(settings: FSRSSettings): void {
        this.settings = settings;
        this.fsrs = this.createFSRS(settings);
    }

    /**
     * Create new card data with default values
     */
    createNewCard(id: string): FSRSCardData {
        const emptyCard = createEmptyCard();
        return {
            id,
            due: emptyCard.due.toISOString(),
            stability: emptyCard.stability,
            difficulty: emptyCard.difficulty,
            reps: emptyCard.reps,
            lapses: emptyCard.lapses,
            state: emptyCard.state,
            lastReview: emptyCard.last_review?.toISOString() ?? null,
            scheduledDays: emptyCard.scheduled_days,
            learningStep: emptyCard.learning_steps,
        };
    }

    /**
     * Convert FSRSCardData to ts-fsrs Card
     */
    private toCard(data: FSRSCardData): Card {
        return {
            due: new Date(data.due),
            stability: data.stability,
            difficulty: data.difficulty,
            elapsed_days: 0, // Will be calculated by ts-fsrs
            scheduled_days: data.scheduledDays,
            reps: data.reps,
            lapses: data.lapses,
            state: data.state,
            last_review: data.lastReview ? new Date(data.lastReview) : undefined,
            learning_steps: data.learningStep,
        };
    }

    /**
     * Convert ts-fsrs Card back to FSRSCardData
     */
    private fromCard(card: Card, id: string): FSRSCardData {
        return {
            id,
            due: card.due.toISOString(),
            stability: card.stability,
            difficulty: card.difficulty,
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            lastReview: card.last_review?.toISOString() ?? null,
            scheduledDays: card.scheduled_days,
            learningStep: card.learning_steps,
        };
    }

    /**
     * Schedule a card after a review
     * @param cardData Current card data
     * @param rating User's rating (Again=1, Hard=2, Good=3, Easy=4)
     * @param reviewTime Optional review timestamp (defaults to now)
     * @returns Updated card data
     */
    scheduleCard(
        cardData: FSRSCardData,
        rating: Grade,
        reviewTime?: Date
    ): FSRSCardData {
        const card = this.toCard(cardData);
        const now = reviewTime ?? new Date();

        // Use next() for a single rating
        const result = this.fsrs.next(card, now, rating);
        return this.fromCard(result.card, cardData.id);
    }

    /**
     * Get scheduling preview for all ratings
     */
    getSchedulingPreview(cardData: FSRSCardData): SchedulingPreview {
        const card = this.toCard(cardData);
        const now = new Date();

        // repeat() returns an IPreview which is a RecordLog
        const result = this.fsrs.repeat(card, now);

        return {
            again: {
                due: result[Rating.Again].card.due,
                interval: this.formatScheduleInterval(result[Rating.Again]),
            },
            hard: {
                due: result[Rating.Hard].card.due,
                interval: this.formatScheduleInterval(result[Rating.Hard]),
            },
            good: {
                due: result[Rating.Good].card.due,
                interval: this.formatScheduleInterval(result[Rating.Good]),
            },
            easy: {
                due: result[Rating.Easy].card.due,
                interval: this.formatScheduleInterval(result[Rating.Easy]),
            },
        };
    }

    /**
     * Format schedule interval for display
     */
    private formatScheduleInterval(recordLogItem: RecordLogItem): string {
        const card = recordLogItem.card;
        const now = new Date();
        const diffMs = card.due.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return formatInterval(diffMinutes);
    }

    /**
     * Check if a card is due for review
     */
    isDue(cardData: FSRSCardData, now?: Date): boolean {
        const dueDate = new Date(cardData.due);
        const currentTime = now ?? new Date();
        return dueDate <= currentTime;
    }

    /**
     * Get due cards from a list
     */
    getDueCards(
        cards: FSRSFlashcardItem[],
        now?: Date
    ): FSRSFlashcardItem[] {
        const currentTime = now ?? new Date();
        return cards.filter((card) => {
            const dueDate = new Date(card.fsrs.due);
            return dueDate <= currentTime;
        });
    }

    /**
     * Get new cards (state === New) from a list
     */
    getNewCards(
        cards: FSRSFlashcardItem[],
        limit?: number
    ): FSRSFlashcardItem[] {
        const newCards = cards.filter((card) => card.fsrs.state === State.New);
        return limit !== undefined ? newCards.slice(0, limit) : newCards;
    }

    /**
     * Get learning cards (state === Learning or Relearning)
     */
    getLearningCards(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
        return cards.filter(
            (card) =>
                card.fsrs.state === State.Learning ||
                card.fsrs.state === State.Relearning
        );
    }

    /**
     * Get review cards (state === Review and due)
     */
    getReviewCards(
        cards: FSRSFlashcardItem[],
        now?: Date
    ): FSRSFlashcardItem[] {
        const currentTime = now ?? new Date();
        return cards.filter((card) => {
            if (card.fsrs.state !== State.Review) return false;
            const dueDate = new Date(card.fsrs.due);
            return dueDate <= currentTime;
        });
    }

    /**
     * Sort cards by due date (earliest first)
     */
    sortByDue(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
        return [...cards].sort((a, b) => {
            const dateA = new Date(a.fsrs.due);
            const dateB = new Date(b.fsrs.due);
            return dateA.getTime() - dateB.getTime();
        });
    }

    /**
     * Get the retrievability (probability of recall) for a card
     * @param cardData Card data
     * @param now Current time (optional)
     * @returns Retrievability as a number between 0 and 1
     */
    getRetrievability(cardData: FSRSCardData, now?: Date): number {
        if (cardData.state === State.New) {
            return 0;
        }

        const card = this.toCard(cardData);
        const currentTime = now ?? new Date();
        // get_retrievability with format=false returns number
        return this.fsrs.get_retrievability(card, currentTime, false) ?? 0;
    }

    /**
     * Calculate statistics for a set of cards
     */
    getStats(cards: FSRSFlashcardItem[]): {
        total: number;
        new: number;
        learning: number;
        review: number;
        relearning: number;
        dueToday: number;
    } {
        const now = new Date();
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        return {
            total: cards.length,
            new: cards.filter((c) => c.fsrs.state === State.New).length,
            learning: cards.filter((c) => c.fsrs.state === State.Learning).length,
            review: cards.filter((c) => c.fsrs.state === State.Review).length,
            relearning: cards.filter((c) => c.fsrs.state === State.Relearning).length,
            dueToday: cards.filter((c) => {
                const due = new Date(c.fsrs.due);
                return due <= todayEnd;
            }).length,
        };
    }
}
