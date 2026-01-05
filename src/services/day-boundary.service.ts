/**
 * Day Boundary Service
 * Centralizes Anki-style day-based scheduling logic
 */
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../types/fsrs.types";

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
}
