/**
 * Implements Anki-style "Next day starts at" logic for day-based scheduling
 */
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../types";
import {
	formatLocalDate as formatLocalDateUtil,
	getTodayBoundary as getTodayBoundaryUtil,
	getTomorrowBoundary as getTomorrowBoundaryUtil,
} from "../../utils";

export class DayBoundaryService {
	private dayStartHour: number;

	constructor(dayStartHour: number = 4) {
		this.dayStartHour = dayStartHour;
	}

	updateDayStartHour(hour: number): void {
		this.dayStartHour = hour;
	}

	/** If current hour < dayStartHour, we're still in "yesterday" */
	getTodayBoundary(now?: Date): Date {
		return getTodayBoundaryUtil(this.dayStartHour, now);
	}

	getTomorrowBoundary(now?: Date): Date {
		return getTomorrowBoundaryUtil(this.dayStartHour, now);
	}

	/**
	 * For Review cards: due before tomorrow's boundary
	 * For Learning/Relearning: exact timestamp check
	 */
	isCardDueToday(card: FSRSFlashcardItem, now?: Date): boolean {
		const currentTime = now ?? new Date();
		const dueDate = new Date(card.fsrs.due);

		// Learning cards use exact timestamp
		if (
			card.fsrs.state === State.Learning ||
			card.fsrs.state === State.Relearning
		) {
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

	isCardAvailable(card: FSRSFlashcardItem, now?: Date): boolean {
		if (card.fsrs.state === State.New) return true;
		return this.isCardDueToday(card, now);
	}

	countDueCards(cards: FSRSFlashcardItem[], now?: Date): number {
		return cards.filter((c) => this.isCardDueToday(c, now)).length;
	}

	getDueCards(cards: FSRSFlashcardItem[], now?: Date): FSRSFlashcardItem[] {
		return cards.filter((c) => this.isCardDueToday(c, now));
	}

	getAvailableCards(
		cards: FSRSFlashcardItem[],
		now?: Date
	): FSRSFlashcardItem[] {
		return cards.filter((c) => this.isCardAvailable(c, now));
	}

	formatLocalDate(date: Date): string {
		return formatLocalDateUtil(date);
	}

	/** At 3 AM with dayStartHour=4, this returns yesterday's date */
	getTodayKey(now?: Date): string {
		const boundary = this.getTodayBoundary(now);
		return this.formatLocalDate(boundary);
	}

	isTimestampToday(timestamp: number, now?: Date): boolean {
		const date = new Date(timestamp);
		const todayBoundary = this.getTodayBoundary(now);
		const tomorrowBoundary = this.getTomorrowBoundary(now);
		return date >= todayBoundary && date < tomorrowBoundary;
	}

	getDayStartHour(): number {
		return this.dayStartHour;
	}
}
