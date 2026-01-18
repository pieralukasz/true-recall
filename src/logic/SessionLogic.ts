/**
 * Session Logic
 * Shared business logic for session selection
 * Used by both SessionModal and SessionView
 */
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../types";
import type { DayBoundaryService } from "../services";

export interface NoteStats {
	noteName: string;
	total: number;
	newCount: number;
	dueCount: number;
	isCompleted: boolean;
}

export interface CardStats {
	total: number;
	newCount: number;
	dueCount: number;
}

/**
 * Business logic for session selection
 * Handles stats calculation, filtering, and data processing
 */
export class SessionLogic {
	constructor(
		private allCards: FSRSFlashcardItem[],
		private dayBoundaryService: DayBoundaryService
	) {}

	/**
	 * Get stats for the current note
	 */
	getCurrentNoteStats(noteName: string | null, now: Date): CardStats | null {
		if (!noteName) return null;

		const cards = this.allCards.filter(
			(c) => c.sourceNoteName === noteName &&
				this.isCardAvailable(c, now) &&
				!c.fsrs.suspended &&
				!this.isCardBuried(c, now)
		);

		if (cards.length === 0) return null;

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	/**
	 * Get stats for cards created today
	 */
	getTodayStats(now: Date, todayStart: Date): CardStats {
		const cards = this.allCards.filter((c) => {
			const createdAt = c.fsrs.createdAt;
			return createdAt &&
				createdAt >= todayStart.getTime() &&
				this.isCardAvailable(c, now) &&
				!c.fsrs.suspended &&
				!this.isCardBuried(c, now);
		});

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	/**
	 * Get stats for all available cards
	 */
	getAllCardsStats(now: Date): CardStats {
		const cards = this.allCards.filter((c) =>
			this.isCardAvailable(c, now) &&
			!c.fsrs.suspended &&
			!this.isCardBuried(c, now)
		);

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	/**
	 * Get stats for buried cards
	 */
	getBuriedCardsStats(now: Date): CardStats {
		const cards = this.allCards.filter((c) => {
			if (!c.fsrs.buriedUntil) return false;
			return new Date(c.fsrs.buriedUntil) > now;
		});

		return {
			total: cards.length,
			newCount: cards.filter((c) => c.fsrs.state === State.New).length,
			dueCount: cards.filter((c) => c.fsrs.state !== State.New).length,
		};
	}

	/**
	 * Get stats for all notes, grouped by source note
	 */
	getAllNoteStats(now: Date): NoteStats[] {
		const noteMap = new Map<string, FSRSFlashcardItem[]>();

		// Group cards by source note
		for (const card of this.allCards) {
			if (!card.sourceNoteName) continue;
			const existing = noteMap.get(card.sourceNoteName) || [];
			existing.push(card);
			noteMap.set(card.sourceNoteName, existing);
		}

		const stats: NoteStats[] = [];

		for (const [noteName, cards] of noteMap) {
			const availableCards = cards.filter((c) =>
				this.isCardAvailable(c, now) &&
				!c.fsrs.suspended &&
				!this.isCardBuried(c, now)
			);
			const newCount = availableCards.filter((c) => c.fsrs.state === State.New).length;
			const dueCount = availableCards.filter((c) => c.fsrs.state !== State.New).length;

			// Check if completed (no new cards remaining for this note)
			const allNewCards = cards.filter((c) => c.fsrs.state === State.New);
			const isCompleted = allNewCards.length === 0 && cards.length > 0;

			stats.push({
				noteName,
				total: availableCards.length,
				newCount,
				dueCount,
				isCompleted,
			});
		}

		return stats;
	}

	/**
	 * Check if a card is available for review
	 */
	isCardAvailable(card: FSRSFlashcardItem, now: Date): boolean {
		return this.dayBoundaryService.isCardAvailable(card, now);
	}

	/**
	 * Check if a card is buried
	 */
	isCardBuried(card: FSRSFlashcardItem, now: Date): boolean {
		if (!card.fsrs.buriedUntil) return false;
		return new Date(card.fsrs.buriedUntil) > now;
	}

	/**
	 * Format stats for display
	 */
	formatStats(newCount: number, dueCount: number): string {
		const parts: string[] = [];
		if (newCount > 0) parts.push(`${newCount} new`);
		if (dueCount > 0) parts.push(`${dueCount} due`);
		return parts.join(" \u00b7 ") || "no cards";
	}

	/**
	 * Get filtered and sorted note stats
	 */
	getFilteredNoteStats(searchQuery: string, now: Date): NoteStats[] {
		const allNoteStats = this.getAllNoteStats(now);

		// Filter by search query and exclude notes with no available cards
		const filteredStats = allNoteStats.filter((stat) =>
			stat.noteName.toLowerCase().includes(searchQuery) &&
			(stat.newCount > 0 || stat.dueCount > 0)
		);

		// Sort: notes with cards first, then completed, alphabetically within groups
		filteredStats.sort((a, b) => {
			// Notes with available cards first
			const aHasCards = a.newCount > 0 || a.dueCount > 0;
			const bHasCards = b.newCount > 0 || b.dueCount > 0;
			if (aHasCards && !bHasCards) return -1;
			if (!aHasCards && bHasCards) return 1;

			// Completed last
			if (a.isCompleted && !b.isCompleted) return 1;
			if (!a.isCompleted && b.isCompleted) return -1;

			// Alphabetical
			return a.noteName.localeCompare(b.noteName);
		});

		return filteredStats;
	}
}
