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
} from "../../types/fsrs.types";
import type { NewCardOrder, ReviewOrder, NewReviewMix } from "../../types/settings.types";
import type { FSRSService } from "../core/fsrs.service";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import { LEARN_AHEAD_LIMIT_MINUTES } from "../../constants";

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
    /** Order for new cards */
    newCardOrder?: NewCardOrder;
    /** Order for review cards */
    reviewOrder?: ReviewOrder;
    /** How to mix new cards with reviews */
    newReviewMix?: NewReviewMix;

    // Custom session filters
    /** Filter by source note name (sourceNoteName field) */
    sourceNoteFilter?: string;
    /** Filter by multiple source note names */
    sourceNoteFilters?: string[];
    /** Filter by flashcard file path */
    filePathFilter?: string;
    /** Only include cards created today */
    createdTodayOnly?: boolean;
    /** Only include cards created in the last 7 days */
    createdThisWeek?: boolean;
    /** Only include weak cards (stability < 7 days) */
    weakCardsOnly?: boolean;
    /** Filter by card state: due, learning, new, or buried */
    stateFilter?: "due" | "learning" | "new" | "buried";
    /** Ignore daily limits for custom sessions */
    ignoreDailyLimits?: boolean;
    /** Bypass scheduling - show all matching cards regardless of due date (like Anki Custom Study) */
    bypassScheduling?: boolean;
    /** Hour when new day starts (0-23, default 4 like Anki) */
    dayStartHour?: number;
}

/**
 * Service for managing review sessions
 */
export class ReviewService {
    /**
     * Shuffle an array using Fisher-Yates algorithm
     */
    private shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j]!, result[i]!];
        }
        return result;
    }

    /**
     * Interleave two arrays (distribute items evenly)
     */
    private interleave<T>(primary: T[], secondary: T[]): T[] {
        if (secondary.length === 0) return [...primary];
        if (primary.length === 0) return [...secondary];

        const result: T[] = [];
        const ratio = primary.length / secondary.length;
        let primaryIndex = 0;
        let secondaryIndex = 0;

        while (primaryIndex < primary.length || secondaryIndex < secondary.length) {
            // Add primary cards based on ratio
            const targetPrimary = Math.floor((secondaryIndex + 1) * ratio);
            while (primaryIndex < targetPrimary && primaryIndex < primary.length) {
                result.push(primary[primaryIndex]!);
                primaryIndex++;
            }
            // Add one secondary card
            if (secondaryIndex < secondary.length) {
                result.push(secondary[secondaryIndex]!);
                secondaryIndex++;
            }
        }
        // Add remaining primary cards
        while (primaryIndex < primary.length) {
            result.push(primary[primaryIndex]!);
            primaryIndex++;
        }

        return result;
    }

    /**
     * Sort cards by creation date (oldest first)
     * Falls back to card ID for cards without createdAt (backward compatibility)
     */
    private sortByCreatedAt(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
        return [...cards].sort((a, b) => {
            const aTime = a.fsrs.createdAt ?? 0;
            const bTime = b.fsrs.createdAt ?? 0;
            if (aTime !== bTime) return aTime - bTime;
            // Fallback to ID for deterministic order
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * Sort cards by creation date (newest first)
     */
    private sortByCreatedAtDesc(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
        return [...cards].sort((a, b) => {
            const aTime = a.fsrs.createdAt ?? 0;
            const bTime = b.fsrs.createdAt ?? 0;
            if (aTime !== bTime) return bTime - aTime;
            return b.id.localeCompare(a.id);
        });
    }

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

        // Get display order settings (with defaults)
        const newCardOrder = options.newCardOrder ?? "random";
        const reviewOrder = options.reviewOrder ?? "due-date";
        const newReviewMix = options.newReviewMix ?? "mix-with-reviews";

        // Apply custom session filters first
        let filteredCards = allCards;

        // Filter by source note name(s)
        if (options.sourceNoteFilters && options.sourceNoteFilters.length > 0) {
            const noteSet = new Set(options.sourceNoteFilters);
            filteredCards = filteredCards.filter(
                card => card.sourceNoteName && noteSet.has(card.sourceNoteName)
            );
        } else if (options.sourceNoteFilter) {
            filteredCards = filteredCards.filter(
                card => card.sourceNoteName === options.sourceNoteFilter
            );
        }

        // Filter by flashcard file path
        if (options.filePathFilter) {
            filteredCards = filteredCards.filter(
                card => card.filePath === options.filePathFilter
            );
        }

        // Filter to only cards created today
        if (options.createdTodayOnly) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            filteredCards = filteredCards.filter(card => {
                const createdAt = card.fsrs.createdAt;
                return createdAt && createdAt >= todayStart.getTime();
            });
        }

        // Filter to only cards created this week (last 7 days)
        if (options.createdThisWeek) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            weekAgo.setHours(0, 0, 0, 0);
            filteredCards = filteredCards.filter(card => {
                const createdAt = card.fsrs.createdAt;
                return createdAt && createdAt >= weekAgo.getTime();
            });
        }

        // Filter weak cards (stability < 7 days)
        if (options.weakCardsOnly) {
            filteredCards = filteredCards.filter(
                card => card.fsrs.stability < 7
            );
        }

        // Filter by state
        if (options.stateFilter) {
            filteredCards = filteredCards.filter(card => {
                switch (options.stateFilter) {
                    case "new":
                        return card.fsrs.state === State.New;
                    case "learning":
                        return card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning;
                    case "due":
                        return card.fsrs.state === State.Review;
                    default:
                        return true;
                }
            });
        }

        // Filter by deck if specified
        if (options.deckFilter) {
            filteredCards = filteredCards.filter(card => card.deck === options.deckFilter);
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

        let dueLearningCards: FSRSFlashcardItem[];
        let pendingLearningCards: FSRSFlashcardItem[];
        let limitedReviewCards: FSRSFlashcardItem[];

        if (options.bypassScheduling) {
            // Bypass scheduling: include all cards regardless of due date
            // All learning cards are treated as "due" (no pending)
            dueLearningCards = allLearningCards;
            pendingLearningCards = [];

            // All review state cards are included, not just due ones
            const reviewCards = availableCards.filter(
                card => card.fsrs.state === State.Review
            );
            const effectiveReviewsLimit = options.ignoreDailyLimits ? reviewCards.length : options.reviewsLimit;
            limitedReviewCards = reviewCards.slice(0, effectiveReviewsLimit);
        } else {
            // Normal scheduling: respect due dates
            // Due learning cards: due now or within learn-ahead window (highest priority)
            dueLearningCards = allLearningCards.filter((card) => {
                const dueDate = new Date(card.fsrs.due);
                return dueDate <= learnAheadTime;
            });

            // Pending learning cards: beyond learn-ahead window (shown at END, after new cards)
            pendingLearningCards = allLearningCards.filter((card) => {
                const dueDate = new Date(card.fsrs.due);
                return dueDate > learnAheadTime;
            });

            // 2. Get due review cards (using day-based scheduling like Anki)
            const dayStartHour = options.dayStartHour ?? 4;
            const reviewCards = fsrsService.getReviewCards(availableCards, now, dayStartHour);
            // If ignoreDailyLimits, don't limit review cards
            const effectiveReviewsLimit = options.ignoreDailyLimits ? reviewCards.length : options.reviewsLimit;
            limitedReviewCards = reviewCards.slice(0, effectiveReviewsLimit);
        }

        // 3. Get new cards (respect daily limit unless ignoreDailyLimits)
        let remainingNewSlots: number;
        if (options.ignoreDailyLimits) {
            // No limit for custom sessions
            remainingNewSlots = Infinity;
        } else {
            remainingNewSlots = Math.max(0, options.newCardsLimit - newCardsStudiedToday);
        }
        let newCards = fsrsService.getNewCards(availableCards, remainingNewSlots);

        // Apply sorting to new cards
        switch (newCardOrder) {
            case "random":
                newCards = this.shuffle(newCards);
                break;
            case "oldest-first":
                newCards = this.sortByCreatedAt(newCards);
                break;
            case "newest-first":
                newCards = this.sortByCreatedAtDesc(newCards);
                break;
        }

        // Apply sorting to review cards
        switch (reviewOrder) {
            case "due-date":
                limitedReviewCards = fsrsService.sortByDue(limitedReviewCards);
                break;
            case "random":
                limitedReviewCards = this.shuffle(limitedReviewCards);
                break;
            case "due-date-random":
                // Sort by due date, then shuffle cards with same due date
                limitedReviewCards = fsrsService.sortByDue(limitedReviewCards);
                // Group by due date (day level) and shuffle within groups
                const groupedByDue = new Map<string, FSRSFlashcardItem[]>();
                for (const card of limitedReviewCards) {
                    const dueDay = new Date(card.fsrs.due).toISOString().split("T")[0] ?? "";
                    if (!groupedByDue.has(dueDay)) {
                        groupedByDue.set(dueDay, []);
                    }
                    groupedByDue.get(dueDay)!.push(card);
                }
                // Shuffle within each group
                limitedReviewCards = [];
                for (const [, group] of groupedByDue) {
                    limitedReviewCards.push(...this.shuffle(group));
                }
                break;
        }

        // Combine based on mix setting
        // Learning cards always go at specific positions (due ones first, pending ones last)
        let mainQueue: FSRSFlashcardItem[];

        switch (newReviewMix) {
            case "show-after-reviews":
                mainQueue = [...limitedReviewCards, ...newCards];
                break;
            case "show-before-reviews":
                mainQueue = [...newCards, ...limitedReviewCards];
                break;
            case "mix-with-reviews":
            default:
                mainQueue = this.interleave(limitedReviewCards, newCards);
                break;
        }

        // Final queue: Due learning (highest priority) → Main queue → Pending learning (lowest)
        const queue: FSRSFlashcardItem[] = [
            ...fsrsService.sortByDue(dueLearningCards),
            ...mainQueue,
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
     * Grade a card and save FSRS data to store
     * Single method for all grading operations (answer, move, etc.)
     */
    async gradeCard(
        card: FSRSFlashcardItem,
        rating: Grade,
        fsrsService: FSRSService,
        flashcardManager: FlashcardManager,
        responseTime: number = 0
    ): Promise<{ updatedCard: FSRSFlashcardItem; result: ReviewResult }> {
        // 1. Calculate new FSRS data
        const { updatedCard, result } = this.processAnswer(card, rating, fsrsService, responseTime);

        // 2. Save to store
        if (card.id && card.filePath) {
            await flashcardManager.updateCardFSRS(
                card.filePath,
                card.id,
                updatedCard.fsrs,
                card.lineNumber
            );
        }

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
     * @param dayBoundaryService Optional day boundary service for accurate due counts
     */
    calculateDailyStats(
        allCards: FSRSFlashcardItem[],
        todayResults: ReviewResult[],
        settings: { newCardsPerDay: number; reviewsPerDay: number },
        dayBoundaryService?: import("../core/day-boundary.service").DayBoundaryService
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

        // Count due cards for today using day-based scheduling if service provided
        const dueToday = dayBoundaryService
            ? dayBoundaryService.countDueCards(allCards, now)
            : allCards.filter((card) => {
                  const dueDate = new Date(card.fsrs.due);
                  return dueDate <= todayEnd && card.fsrs.state !== State.New;
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
