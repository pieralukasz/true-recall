/**
 * FSRS Utility Functions
 * Helper functions for FSRS operations
 */

import type { FSRSCardData } from "./card.types";

/**
 * Review view display mode
 */
export type ReviewViewMode = "fullscreen" | "panel";

/**
 * Default FSRS data for a new card
 */
export function createDefaultFSRSData(id: string): FSRSCardData {
	return {
		id,
		due: new Date().toISOString(),
		stability: 0,
		difficulty: 0,
		reps: 0,
		lapses: 0,
		state: 0, // State.New
		lastReview: null,
		scheduledDays: 0,
		learningStep: 0,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}

/**
 * Format interval to readable form
 * Intervals of a day or more always show exact days (e.g., "92d", "730d"),
 * never months or years, so the user sees precisely when the card returns.
 * @param minutes Number of minutes
 * @returns Formatted string (e.g., "<1m", "10m", "3h", "92d")
 */
export function formatInterval(minutes: number): string {
	if (minutes < 1) {
		return "<1m";
	}
	if (minutes < 60) {
		return `${Math.round(minutes)}m`;
	}
	if (minutes < 60 * 24) {
		const hours = Math.round(minutes / 60);
		return `${hours}h`;
	}
	const days = Math.round(minutes / (60 * 24));
	return `${days}d`;
}
