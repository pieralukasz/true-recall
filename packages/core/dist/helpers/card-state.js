/**
 * Card State Helpers
 * Shared utilities for filtering and counting cards by FSRS state
 */
import { State } from "ts-fsrs";
/**
 * Filter out suspended and buried cards
 * Returns only cards that are currently active (not suspended, not buried)
 */
export function filterActiveCardsOnly(cards, options = {}) {
    var _a;
    const now = (_a = options.now) !== null && _a !== void 0 ? _a : new Date();
    return cards.filter((card) => {
        if (card.suspended)
            return false;
        if (card.buriedUntil) {
            const buriedUntil = new Date(card.buriedUntil);
            if (buriedUntil > now)
                return false;
        }
        return true;
    });
}
/**
 * Count cards by FSRS state (New, Learning, Review)
 * Excludes suspended and buried cards
 */
export function countCardsByState(cards) {
    const counts = { new: 0, learning: 0, review: 0 };
    const now = new Date();
    for (const card of cards) {
        if (card.fsrs.suspended)
            continue;
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
 */
export function countCardsByStateWithDue(cards, tomorrowBoundary) {
    const counts = {
        new: 0,
        learning: 0,
        review: 0,
        due: 0,
    };
    const now = new Date();
    for (const card of cards) {
        if (card.suspended)
            continue;
        if (card.buriedUntil) {
            const buriedUntil = new Date(card.buriedUntil);
            if (buriedUntil > now)
                continue;
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
export function aggregateCardStateCounts(countsList) {
    return countsList.reduce((acc, counts) => ({
        new: acc.new + counts.new,
        learning: acc.learning + counts.learning,
        review: acc.review + counts.review,
    }), { new: 0, learning: 0, review: 0 });
}
