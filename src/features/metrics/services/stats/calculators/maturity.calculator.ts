/**
 * Maturity Calculator
 * Calculates card maturity breakdown statistics
 */

import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { CardMaturityBreakdown, FSRSFlashcardItem } from "@shared/types";
import { State } from "ts-fsrs";

/**
 * Calculator for card maturity statistics
 */
export class MaturityCalculator {
	constructor(private sqliteStore: SqliteStoreService | null = null) {}

	/**
	 * Set SQLite store for optimized queries
	 */
	setSqliteStore(store: SqliteStoreService): void {
		this.sqliteStore = store;
	}

	/**
	 * Get card maturity breakdown for pie chart
	 * Young: Review cards with interval < 21 days
	 * Mature: Review cards with interval >= 21 days
	 */
	calculate(allCards: FSRSFlashcardItem[]): CardMaturityBreakdown {
		// Use optimized SQLite query when available
		if (this.sqliteStore) {
			return this.sqliteStore.stats.getCardMaturityBreakdown();
		}

		// Fallback to iterating all cards
		return this.calculateFromCards(allCards);
	}

	/**
	 * Calculate breakdown from card array
	 */
	calculateFromCards(allCards: FSRSFlashcardItem[]): CardMaturityBreakdown {
		const now = new Date();

		// Single-pass accumulator (O(n) instead of O(n*6))
		const counts: CardMaturityBreakdown = {
			new: 0,
			learning: 0,
			young: 0,
			mature: 0,
			suspended: 0,
			buried: 0,
		};

		for (const c of allCards) {
			// Suspended takes precedence
			if (c.fsrs.suspended) {
				counts.suspended++;
				continue;
			}

			// Check if buried
			if (c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now) {
				counts.buried++;
				continue;
			}

			// Active cards - categorize by state
			if (c.fsrs.state === State.New) {
				counts.new++;
			} else if (
				c.fsrs.state === State.Learning ||
				c.fsrs.state === State.Relearning
			) {
				counts.learning++;
			} else if (c.fsrs.state === State.Review) {
				if (c.fsrs.scheduledDays < 21) {
					counts.young++;
				} else {
					counts.mature++;
				}
			}
		}

		return counts;
	}

	/**
	 * Get cards by maturity category
	 */
	getCardsByCategory(
		allCards: FSRSFlashcardItem[],
		category: keyof CardMaturityBreakdown,
	): FSRSFlashcardItem[] {
		const now = new Date();

		// Helper to check if card is active (not suspended and not currently buried)
		const isActive = (c: FSRSFlashcardItem) => {
			if (c.fsrs.suspended) return false;
			if (c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now)
				return false;
			return true;
		};

		// Helper to check if card is currently buried
		const isBuried = (c: FSRSFlashcardItem) => {
			if (c.fsrs.suspended) return false; // Suspended takes precedence
			return c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now;
		};

		switch (category) {
			case "new":
				return allCards.filter(
					(c) => isActive(c) && c.fsrs.state === State.New,
				);
			case "learning":
				return allCards.filter(
					(c) =>
						isActive(c) &&
						(c.fsrs.state === State.Learning ||
							c.fsrs.state === State.Relearning),
				);
			case "young":
				return allCards.filter(
					(c) =>
						isActive(c) &&
						c.fsrs.state === State.Review &&
						c.fsrs.scheduledDays < 21,
				);
			case "mature":
				return allCards.filter(
					(c) =>
						isActive(c) &&
						c.fsrs.state === State.Review &&
						c.fsrs.scheduledDays >= 21,
				);
			case "suspended":
				return allCards.filter((c) => c.fsrs.suspended);
			case "buried":
				return allCards.filter((c) => isBuried(c));
			default:
				return [];
		}
	}
}
