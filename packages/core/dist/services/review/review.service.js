import { Rating, State } from "ts-fsrs";
import { LEARN_AHEAD_LIMIT_MINUTES, MS_PER_DAY, RANDOM_QUEUE_INSERT_MAX_POS, } from "../../constants";
import { isLearningState } from "../../helpers/card-state";
import { formatLocalDate, getTodayBoundary, getTomorrowBoundary, } from "../../utils";
import { buildQueue as buildQueueImpl } from "./queue-builder";
import { spaceSiblings as spaceSiblingsImpl } from "./sibling-spacer";
export class ReviewService {
    /**
     * When burySiblings is off, spread IO/cloze siblings apart in the queue
     * so cards from the same note don't appear back-to-back.
     */
    spaceSiblings(queue) {
        return spaceSiblingsImpl(queue);
    }
    /** Order (Anki-like): Due Learning -> Review -> New -> Pending Learning */
    buildQueue(allCards, fsrsService, options) {
        return buildQueueImpl(allCards, fsrsService, options);
    }
    processAnswer(card, rating, fsrsService, responseTime, presetSettings) {
        const now = new Date();
        const previousState = card.fsrs.state;
        const previousScheduledDays = card.fsrs.scheduledDays;
        // Calculate elapsed days since last review
        const elapsedDays = card.fsrs.lastReview
            ? Math.max(0, Math.floor((now.getTime() - new Date(card.fsrs.lastReview).getTime()) /
                MS_PER_DAY))
            : 0;
        const newFsrsData = fsrsService.scheduleCard(card.fsrs, rating, now, presetSettings);
        const updatedCard = Object.assign(Object.assign({}, card), { fsrs: newFsrsData });
        const result = {
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
    gradeCard(card, rating, fsrsService, flashcardManager, responseTime = 0) {
        var _a;
        // 1. Calculate new FSRS data
        const { updatedCard, result } = this.processAnswer(card, rating, fsrsService, responseTime);
        // 2. Save to store
        let persisted = false;
        if (card.id) {
            persisted = flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);
            if (persisted) {
                (_a = flashcardManager.getEventBus()) === null || _a === void 0 ? void 0 : _a.emit("card:reviewed", {
                    cardId: card.id,
                    rating: rating,
                    newState: updatedCard.fsrs.state,
                });
            }
        }
        return { updatedCard, result, persisted };
    }
    calculateSessionStats(results, totalCards, startTime) {
        const now = Date.now();
        // Single-pass accumulator - count all stats in one iteration
        const counts = {
            again: 0,
            hard: 0,
            good: 0,
            easy: 0,
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
        };
        for (const r of results) {
            // Count by rating
            switch (r.rating) {
                case Rating.Again:
                    counts.again++;
                    break;
                case Rating.Hard:
                    counts.hard++;
                    break;
                case Rating.Good:
                    counts.good++;
                    break;
                case Rating.Easy:
                    counts.easy++;
                    break;
            }
            // Count by previous state
            switch (r.previousState) {
                case State.New:
                    counts.newCards++;
                    break;
                case State.Learning:
                case State.Relearning:
                    counts.learningCards++;
                    break;
                case State.Review:
                    counts.reviewCards++;
                    break;
            }
        }
        return Object.assign(Object.assign({ total: totalCards, reviewed: results.length }, counts), { duration: now - startTime });
    }
    calculateDailyStats(allCards, todayResults, settings, dayBoundaryService) {
        var _a;
        const now = new Date();
        const dayStartHour = (_a = settings.dayStartHour) !== null && _a !== void 0 ? _a : 4;
        const todayBoundary = dayBoundaryService
            ? dayBoundaryService.getTodayBoundary(now)
            : getTodayBoundary(dayStartHour, now);
        const tomorrowBoundary = dayBoundaryService
            ? dayBoundaryService.getTomorrowBoundary(now)
            : getTomorrowBoundary(dayStartHour, now);
        // Count new cards reviewed today
        const newReviewedToday = todayResults.filter((r) => r.previousState === State.New).length;
        // Count due cards for today using day-based scheduling
        const dueToday = dayBoundaryService
            ? dayBoundaryService.countDueCards(allCards, now)
            : allCards.filter((card) => {
                const dueDate = new Date(card.fsrs.due);
                return dueDate < tomorrowBoundary && card.fsrs.state !== State.New;
            }).length;
        // Calculate remaining new cards
        const newRemaining = Math.max(0, settings.newCardsPerDay - newReviewedToday);
        return {
            newReviewed: newReviewedToday,
            reviewsCompleted: todayResults.length,
            dueToday,
            newRemaining,
            date: formatLocalDate(todayBoundary),
        };
    }
    /**
     * Check if a card should be re-added to queue (for learning cards)
     * Learning/Relearning cards are ALWAYS requeued - the position is determined
     * by getRequeuePosition(). Cards due soon go near the front, cards due later
     * go at the end where getPhase() will trigger the waiting screen.
     */
    shouldRequeue(card) {
        return isLearningState(card.fsrs.state);
    }
    getRequeuePosition(queue, startIndex, card, reviewOrder) {
        const dueDate = new Date(card.fsrs.due);
        const now = new Date();
        // For random sort: insert learning cards near front with some randomness
        // Using due-date ordering in a shuffled queue would place cards incorrectly
        if (reviewOrder === "random") {
            const learnAheadTime = new Date(now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000);
            if (dueDate <= learnAheadTime) {
                // Card is due soon - insert randomly in first positions after startIndex
                const remaining = queue.length - startIndex;
                const maxPos = Math.min(RANDOM_QUEUE_INSERT_MAX_POS, remaining);
                return startIndex + Math.floor(Math.random() * (maxPos + 1));
            }
            // Card not due yet - append to end
            return queue.length;
        }
        // For due-date or due-date-random: binary search within remaining queue
        const dueTime = dueDate.getTime();
        let low = startIndex;
        let high = queue.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            const midCard = queue[mid];
            if (!midCard) {
                low = mid + 1;
                continue;
            }
            const midDue = new Date(midCard.fsrs.due).getTime();
            if (midDue < dueTime) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    calculateRetentionRate(results) {
        if (results.length === 0)
            return 0;
        const successes = results.filter((r) => r.rating === Rating.Good || r.rating === Rating.Easy).length;
        return successes / results.length;
    }
    getStreakInfo(results, dayStartHour = 4) {
        if (results.length === 0)
            return { currentStreak: 0, longestStreak: 0 };
        // Group reviews by FSRS day (adjusted by dayStartHour)
        const uniqueDays = new Set(results.map((r) => {
            const d = new Date(r.timestamp);
            // Shift by dayStartHour so e.g. 3 AM maps to "yesterday"
            d.setHours(d.getHours() - dayStartHour);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }));
        const sortedDays = [...uniqueDays]
            .map((key) => {
            const [y = 0, m = 0, d = 1] = key.split("-").map(Number);
            const date = new Date(y, m, d);
            date.setHours(0, 0, 0, 0);
            return date.getTime();
        })
            .sort((a, b) => b - a);
        const DAY_MS = MS_PER_DAY;
        let longestStreak = 1;
        let currentStreak = 1;
        // Walk sorted days (newest first), count consecutive
        for (let i = 1; i < sortedDays.length; i++) {
            const prev = sortedDays[i - 1];
            const curr = sortedDays[i];
            if (prev !== undefined && curr !== undefined && prev - curr === DAY_MS) {
                currentStreak++;
            }
            else {
                if (currentStreak > longestStreak)
                    longestStreak = currentStreak;
                currentStreak = 1;
            }
        }
        if (currentStreak > longestStreak)
            longestStreak = currentStreak;
        // Current streak: count consecutive days ending at today or yesterday
        const now = new Date();
        now.setHours(now.getHours() - dayStartHour);
        now.setHours(0, 0, 0, 0);
        const todayMs = now.getTime();
        const yesterdayMs = todayMs - DAY_MS;
        const newest = sortedDays[0];
        if (newest !== todayMs && newest !== yesterdayMs) {
            return { currentStreak: 0, longestStreak };
        }
        let streak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
            const prev = sortedDays[i - 1];
            const curr = sortedDays[i];
            if (prev !== undefined && curr !== undefined && prev - curr === DAY_MS) {
                streak++;
            }
            else {
                break;
            }
        }
        return { currentStreak: streak, longestStreak };
    }
}
