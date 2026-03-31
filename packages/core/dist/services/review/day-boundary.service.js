/**
 * Implements Anki-style "Next day starts at" logic for day-based scheduling
 */
import { State } from "ts-fsrs";
import { formatLocalDate as formatLocalDateUtil, getTodayBoundary as getTodayBoundaryUtil, getTomorrowBoundary as getTomorrowBoundaryUtil, } from "../../utils";
export class DayBoundaryService {
    constructor(dayStartHour = 4) {
        this.dayStartHour = dayStartHour;
    }
    updateDayStartHour(hour) {
        this.dayStartHour = hour;
    }
    /** If current hour < dayStartHour, we're still in "yesterday" */
    getTodayBoundary(now) {
        return getTodayBoundaryUtil(this.dayStartHour, now);
    }
    getTomorrowBoundary(now) {
        return getTomorrowBoundaryUtil(this.dayStartHour, now);
    }
    /**
     * For Review cards: due before tomorrow's boundary
     * For Learning/Relearning: exact timestamp check
     */
    isCardDueToday(card, now) {
        const currentTime = now !== null && now !== void 0 ? now : new Date();
        const dueDate = new Date(card.fsrs.due);
        // Learning cards use exact timestamp
        if (card.fsrs.state === State.Learning ||
            card.fsrs.state === State.Relearning) {
            return dueDate <= currentTime;
        }
        // Review cards use day-based scheduling
        if (card.fsrs.state === State.Review) {
            const tomorrowBoundary = this.getTomorrowBoundary(currentTime);
            return dueDate < tomorrowBoundary;
        }
        // New cards are always "available" (not "due")
        return false;
    }
    isCardAvailable(card, now) {
        if (card.fsrs.state === State.New)
            return true;
        return this.isCardDueToday(card, now);
    }
    countDueCards(cards, now) {
        return cards.filter((c) => this.isCardDueToday(c, now)).length;
    }
    getDueCards(cards, now) {
        return cards.filter((c) => this.isCardDueToday(c, now));
    }
    getAvailableCards(cards, now) {
        return cards.filter((c) => this.isCardAvailable(c, now));
    }
    formatLocalDate(date) {
        return formatLocalDateUtil(date);
    }
    /** At 3 AM with dayStartHour=4, this returns yesterday's date */
    getTodayKey(now) {
        const boundary = this.getTodayBoundary(now);
        return this.formatLocalDate(boundary);
    }
    isTimestampToday(timestamp, now) {
        const date = new Date(timestamp);
        const todayBoundary = this.getTodayBoundary(now);
        const tomorrowBoundary = this.getTomorrowBoundary(now);
        return date >= todayBoundary && date < tomorrowBoundary;
    }
    getDayStartHour() {
        return this.dayStartHour;
    }
}
