import { FSRS_COLORS, fsrsStateToColorName, } from "@true-recall/obsidian/helpers/fsrs-colors";
import { State } from "ts-fsrs";
export function getStatusTitle(fsrsCard) {
    if (!fsrsCard)
        return "Unknown";
    switch (fsrsCard.fsrs.state) {
        case State.New:
            return "New";
        case State.Learning:
            return "Learning";
        case State.Relearning:
            return "Relearning";
        case State.Review:
            return "Review";
        default:
            return "Unknown";
    }
}
export function isSuspended(fsrsCard) {
    return (fsrsCard === null || fsrsCard === void 0 ? void 0 : fsrsCard.fsrs.suspended) === true;
}
export function isBuried(fsrsCard) {
    const buriedUntil = fsrsCard === null || fsrsCard === void 0 ? void 0 : fsrsCard.fsrs.buriedUntil;
    if (!buriedUntil)
        return false;
    return new Date(buriedUntil) > new Date();
}
export function getHighlightColor(fsrsCard) {
    var _a;
    if (!fsrsCard)
        return "default";
    if (isSuspended(fsrsCard))
        return FSRS_COLORS.suspended.name;
    if (isBuried(fsrsCard))
        return "default";
    return (_a = fsrsStateToColorName(fsrsCard.fsrs.state)) !== null && _a !== void 0 ? _a : "default";
}
export function countByState(cards, reviewedToday, dayStartHour = 4) {
    const counts = { new: 0, learning: 0, review: 0 };
    const now = new Date();
    const todayBoundary = new Date(now);
    if (now.getHours() < dayStartHour) {
        todayBoundary.setDate(todayBoundary.getDate() - 1);
    }
    todayBoundary.setHours(dayStartHour, 0, 0, 0);
    const tomorrowBoundary = new Date(todayBoundary);
    tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1);
    for (const card of cards) {
        if (card.fsrs.suspended)
            continue;
        if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
            continue;
        const isLearning = card.fsrs.state === State.Learning ||
            card.fsrs.state === State.Relearning;
        if (!isLearning && (reviewedToday === null || reviewedToday === void 0 ? void 0 : reviewedToday.has(card.id)))
            continue;
        switch (card.fsrs.state) {
            case State.New:
                counts.new++;
                break;
            case State.Learning:
            case State.Relearning:
                counts.learning++;
                break;
            case State.Review: {
                const dueDate = new Date(card.fsrs.due);
                if (dueDate < tomorrowBoundary) {
                    counts.review++;
                }
                break;
            }
        }
    }
    return counts;
}
