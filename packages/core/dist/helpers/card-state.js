/**
 * Card State Helpers
 * Shared utilities for filtering and counting cards by FSRS state
 */
import { State } from "ts-fsrs";
/** Learning or Relearning */
export function isLearningState(state) {
    return state === State.Learning || state === State.Relearning;
}
export function isNewState(state) {
    return state === State.New;
}
export function isReviewState(state) {
    return state === State.Review;
}
/**
 * Check whether a card is active (not suspended, not currently buried).
 * Works with any data shape — pass the individual fields.
 */
export function isCardActive(suspended, buriedUntil, now) {
    if (suspended)
        return false;
    if (buriedUntil) {
        if (new Date(buriedUntil) > (now !== null && now !== void 0 ? now : new Date()))
            return false;
    }
    return true;
}
/**
 * Filter out suspended and buried cards
 * Returns only cards that are currently active (not suspended, not buried)
 */
export function filterActiveCardsOnly(cards, options = {}) {
    var _a;
    const now = (_a = options.now) !== null && _a !== void 0 ? _a : new Date();
    return cards.filter((card) => isCardActive(card.suspended, card.buriedUntil, now));
}
/**
 * Count cards by FSRS state (New, Learning, Review)
 * Excludes suspended and buried cards
 */
export function countCardsByState(cards) {
    const counts = { new: 0, learning: 0, review: 0 };
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
export function countCardsByStateWithDue(cards, tomorrowBoundary) {
    const counts = {
        new: 0,
        learning: 0,
        review: 0,
        due: 0,
    };
    const now = new Date();
    for (const card of cards) {
        if (!isCardActive(card.suspended, card.buriedUntil, now))
            continue;
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
