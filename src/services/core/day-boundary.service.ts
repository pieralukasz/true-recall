/**
 * Day Boundary Service
 * Centralizes Anki-style day-based scheduling logic
 */
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../types";

/**
 * Service for day-based scheduling calculations
 * Implements Anki-style "Next day starts at" logic
 */
export class DayBoundaryService {
	private dayStartHour: number;

	constructor(dayStartHour: number = 4) {
		this.dayStartHour = dayStartHour;
	}

	/**
	 * Update the day start hour setting
	 */
	updateDayStartHour(hour: number): void {
		this.dayStartHour = hour;
	}

	/**
	 * Get today's boundary based on dayStartHour
	 * If current hour < dayStartHour, we're still in "yesterday"
	 */
	getTodayBoundary(now?: Date): Date {
		const currentTime = now ?? new Date();
		const boundary = new Date(currentTime);
		if (currentTime.getHours() < this.dayStartHour) {
			boundary.setDate(boundary.getDate() - 1);
		}
		boundary.setHours(this.dayStartHour, 0, 0, 0);
		return boundary;
	}

	/**
	 * Get tomorrow's boundary (end of "today")
	 */
	getTomorrowBoundary(now?: Date): Date {
		const today = this.getTodayBoundary(now);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow;
	}

	/**
	 * Check if a card is due today (day-based, not exact timestamp)
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

	/**
	 * Check if a card is available for study (new OR due)
	 */
	isCardAvailable(card: FSRSFlashcardItem, now?: Date): boolean {
		if (card.fsrs.state === State.New) return true;
		return this.isCardDueToday(card, now);
	}

	/**
	 * Count due cards (excluding new)
	 */
	countDueCards(cards: FSRSFlashcardItem[], now?: Date): number {
		return cards.filter((c) => this.isCardDueToday(c, now)).length;
	}

	/**
	 * Filter cards to get only due cards
	 */
	getDueCards(cards: FSRSFlashcardItem[], now?: Date): FSRSFlashcardItem[] {
		return cards.filter((c) => this.isCardDueToday(c, now));
	}

	/**
	 * Filter cards to get available cards (new or due)
	 */
	getAvailableCards(
		cards: FSRSFlashcardItem[],
		now?: Date
	): FSRSFlashcardItem[] {
		return cards.filter((c) => this.isCardAvailable(c, now));
	}

	/**
	 * Format a date as local YYYY-MM-DD (NOT UTC)
	 * Uses local calendar date to avoid timezone issues with toISOString()
	 */
	formatLocalDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	/**
	 * Get today's date key (YYYY-MM-DD) respecting dayStartHour
	 * At 3 AM with dayStartHour=4, this returns yesterday's date
	 */
	getTodayKey(now?: Date): string {
		const boundary = this.getTodayBoundary(now);
		return this.formatLocalDate(boundary);
	}

	/**
	 * Check if a timestamp falls within "today" (respecting dayStartHour)
	 */
	isTimestampToday(timestamp: number, now?: Date): boolean {
		const date = new Date(timestamp);
		const todayBoundary = this.getTodayBoundary(now);
		const tomorrowBoundary = this.getTomorrowBoundary(now);
		return date >= todayBoundary && date < tomorrowBoundary;
	}

	/**
	 * Get the current dayStartHour setting
	 */
	getDayStartHour(): number {
		return this.dayStartHour;
	}
}
