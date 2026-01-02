/**
 * Review Session Service
 * Manages review session logic: queue building, answer processing, statistics
 */
import { State, type Grade } from "ts-fsrs";
import type {
    FSRSFlashcardItem,
    ReviewResult,
    ReviewSessionStats,
    DailyStats,
} from "../types/fsrs.types";
import type { FSRSService } from "./fsrs.service";
import { LEARN_AHEAD_LIMIT_MINUTES } from "../constants";

/**
 * Options for building review queue
 */
export interface QueueBuildOptions {
    /** Maximum new cards to include */
    newCardsLimit: number;
    /** Maximum reviews to include */
    reviewsLimit: number;
    /** Cards already reviewed today (to exclude) */
    reviewedToday?: Set<string>;
    /** New cards already studied today */
    newCardsStudiedToday?: number;
    /** Filter by deck name (null = all decks) */
    deckFilter?: string | null;
}

/**
 * Service for managing review sessions
 */
export class ReviewService {
    /**
     * Build a review queue from all available cards
     * Order (Anki-like): Due Learning → Review → New → Pending Learning
     * Pending learning cards go at the END so waiting screen only shows when all other cards are done
     */
    buildQueue(
        allCards: FSRSFlashcardItem[],
        fsrsService: FSRSService,
        options: QueueBuildOptions
    ): FSRSFlashcardItem[] {
        const now = new Date();
        const reviewedToday = options.reviewedToday ?? new Set<string>();
        const newCardsStudiedToday = options.newCardsStudiedToday ?? 0;

        // Filter by deck if specified
        let filteredCards = allCards;
        if (options.deckFilter) {
            filteredCards = allCards.filter(card => card.deck === options.deckFilter);
        }

        // Filter out already reviewed cards, BUT keep learning/relearning cards
        // (they need multiple reviews per day)
        const availableCards = filteredCards.filter((card) => {
            const isLearning = card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning;
            return isLearning || !reviewedToday.has(card.id);
        });

        // 1. Get learning and relearning cards, split by due status
        // Learn ahead limit (like Anki)
        const learnAheadTime = new Date(now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000);
        const allLearningCards = fsrsService.getLearningCards(availableCards);

        // Due learning cards: due now or within learn-ahead window (highest priority)
        const dueLearningCards = allLearningCards.filter((card) => {
            const dueDate = new Date(card.fsrs.due);
            return dueDate <= learnAheadTime;
        });

        // Pending learning cards: beyond learn-ahead window (shown at END, after new cards)
        const pendingLearningCards = allLearningCards.filter((card) => {
            const dueDate = new Date(card.fsrs.due);
            return dueDate > learnAheadTime;
        });

        // 2. Get due review cards
        const reviewCards = fsrsService.getReviewCards(availableCards, now);
        const limitedReviewCards = reviewCards.slice(0, options.reviewsLimit);

        // 3. Get new cards (respect daily limit)
        const remainingNewSlots = Math.max(
            0,
            options.newCardsLimit - newCardsStudiedToday
        );
        const newCards = fsrsService.getNewCards(availableCards, remainingNewSlots);

        // Combine in Anki order:
        // 1. Due learning cards (within learn-ahead window) - highest priority
        // 2. Review cards
        // 3. New cards
        // 4. Pending learning cards (beyond learn-ahead) - at the END
        // This way, waiting screen only shows when all other cards are done
        const queue: FSRSFlashcardItem[] = [
            ...fsrsService.sortByDue(dueLearningCards),
            ...fsrsService.sortByDue(limitedReviewCards),
            ...newCards,
            ...fsrsService.sortByDue(pendingLearningCards),
        ];

        return queue;
    }

    /**
     * Process an answer and return updated card data
     */
    processAnswer(
        card: FSRSFlashcardItem,
        rating: Grade,
        fsrsService: FSRSService,
        responseTime: number
    ): {
        updatedCard: FSRSFlashcardItem;
        result: ReviewResult;
    } {
        const now = new Date();
        const previousState = card.fsrs.state;
        const previousScheduledDays = card.fsrs.scheduledDays;

        // Calculate elapsed days since last review
        const elapsedDays = card.fsrs.lastReview
            ? Math.max(
                  0,
                  Math.floor(
                      (now.getTime() - new Date(card.fsrs.lastReview).getTime()) /
                          (1000 * 60 * 60 * 24)
                  )
              )
            : 0;

        // Schedule the card
        const newFsrsData = fsrsService.scheduleCard(card.fsrs, rating, now);

        const updatedCard: FSRSFlashcardItem = {
            ...card,
            fsrs: newFsrsData,
        };

        const result: ReviewResult = {
            cardId: card.id,
            rating,
            timestamp: now.getTime(),
            responseTime,
            previousState,
            scheduledDays: previousScheduledDays,
            elapsedDays,
        };

        return { updatedCard, result };
    }

    /**
     * Calculate session statistics from review results
     */
    calculateSessionStats(
        results: ReviewResult[],
        totalCards: number,
        startTime: number
    ): ReviewSessionStats {
        const now = Date.now();

        return {
            total: totalCards,
            reviewed: results.length,
            again: results.filter((r) => r.rating === 1).length,
            hard: results.filter((r) => r.rating === 2).length,
            good: results.filter((r) => r.rating === 3).length,
            easy: results.filter((r) => r.rating === 4).length,
            newCards: results.filter((r) => r.previousState === State.New).length,
            learningCards: results.filter(
                (r) =>
                    r.previousState === State.Learning ||
                    r.previousState === State.Relearning
            ).length,
            reviewCards: results.filter((r) => r.previousState === State.Review)
                .length,
            duration: now - startTime,
        };
    }

    /**
     * Calculate daily statistics
     */
    calculateDailyStats(
        allCards: FSRSFlashcardItem[],
        todayResults: ReviewResult[],
        settings: { newCardsPerDay: number; reviewsPerDay: number }
    ): DailyStats {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Count new cards reviewed today
        const newReviewedToday = todayResults.filter(
            (r) => r.previousState === State.New
        ).length;

        // Count due cards for today
        const dueToday = allCards.filter((card) => {
            const dueDate = new Date(card.fsrs.due);
            return (
                dueDate <= todayEnd &&
                card.fsrs.state !== State.New
            );
        }).length;

        // Calculate remaining new cards
        const newRemaining = Math.max(
            0,
            settings.newCardsPerDay - newReviewedToday
        );

        return {
            newReviewed: newReviewedToday,
            reviewsCompleted: todayResults.length,
            dueToday,
            newRemaining,
            date: todayStart.toISOString().split("T")[0] ?? "",
        };
    }

    /**
     * Check if a card should be re-added to queue (for learning cards)
     */
    shouldRequeue(card: FSRSFlashcardItem): boolean {
        // Learning and relearning cards get re-added if their due time is soon
        if (
            card.fsrs.state === State.Learning ||
            card.fsrs.state === State.Relearning
        ) {
            const dueDate = new Date(card.fsrs.due);
            const now = new Date();
            // Re-add if due within 10 minutes
            const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
            return dueDate <= tenMinutesFromNow;
        }
        return false;
    }

    /**
     * Get the next position to insert a re-queued card
     */
    getRequeuePosition(
        queue: FSRSFlashcardItem[],
        card: FSRSFlashcardItem
    ): number {
        const dueDate = new Date(card.fsrs.due);

        // Find the position where this card should be inserted based on due time
        for (let i = 0; i < queue.length; i++) {
            const queueCard = queue[i];
            if (!queueCard) continue;
            const queueDue = new Date(queueCard.fsrs.due);
            if (dueDate < queueDue) {
                return i;
            }
        }
        return queue.length;
    }

    /**
     * Calculate retention rate from review history
     */
    calculateRetentionRate(results: ReviewResult[]): number {
        if (results.length === 0) return 0;

        const successfulReviews = results.filter(
            (r) => r.rating >= 3 // Good or Easy
        ).length;

        return successfulReviews / results.length;
    }

    /**
     * Get streak information (consecutive days of review)
     */
    getStreakInfo(reviewHistory: ReviewResult[]): {
        currentStreak: number;
        longestStreak: number;
    } {
        if (reviewHistory.length === 0) {
            return { currentStreak: 0, longestStreak: 0 };
        }

        // Get unique review days
        const reviewDays = new Set(
            reviewHistory.map((r) => {
                const date = new Date(r.timestamp);
                return date.toISOString().split("T")[0];
            })
        );

        const sortedDays = Array.from(reviewDays).sort();

        let currentStreak = 0;
        let longestStreak = 0;
        let streak = 0;

        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000)
            .toISOString()
            .split("T")[0];

        for (let i = 0; i < sortedDays.length; i++) {
            const currentDay = sortedDays[i];
            if (!currentDay) continue;

            if (i === 0) {
                streak = 1;
            } else {
                const prevDay = sortedDays[i - 1];
                if (!prevDay) continue;

                const prevDate = new Date(prevDay);
                const currDate = new Date(currentDay);
                const diffDays = Math.floor(
                    (currDate.getTime() - prevDate.getTime()) / 86400000
                );

                if (diffDays === 1) {
                    streak++;
                } else {
                    streak = 1;
                }
            }

            longestStreak = Math.max(longestStreak, streak);

            // Check if this contributes to current streak
            if (currentDay === today || currentDay === yesterday) {
                currentStreak = streak;
            }
        }

        // If last review wasn't today or yesterday, current streak is 0
        const lastDay = sortedDays[sortedDays.length - 1];
        if (lastDay !== today && lastDay !== yesterday) {
            currentStreak = 0;
        }

        return { currentStreak, longestStreak };
    }
}
