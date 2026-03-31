/**
 * Implements Anki-style "Next day starts at" logic for day-based scheduling
 */
import type { CardSchedulingMeta } from "../../types";
export declare class DayBoundaryService {
    private dayStartHour;
    constructor(dayStartHour?: number);
    updateDayStartHour(hour: number): void;
    /** If current hour < dayStartHour, we're still in "yesterday" */
    getTodayBoundary(now?: Date): Date;
    getTomorrowBoundary(now?: Date): Date;
    /**
     * For Review cards: due before tomorrow's boundary
     * For Learning/Relearning: exact timestamp check
     */
    isCardDueToday(card: CardSchedulingMeta, now?: Date): boolean;
    isCardAvailable(card: CardSchedulingMeta, now?: Date): boolean;
    countDueCards(cards: CardSchedulingMeta[], now?: Date): number;
    getDueCards<T extends CardSchedulingMeta>(cards: T[], now?: Date): T[];
    getAvailableCards<T extends CardSchedulingMeta>(cards: T[], now?: Date): T[];
    formatLocalDate(date: Date): string;
    /** At 3 AM with dayStartHour=4, this returns yesterday's date */
    getTodayKey(now?: Date): string;
    isTimestampToday(timestamp: number, now?: Date): boolean;
    getDayStartHour(): number;
}
