/**
 * Custom Session Result Factory
 * Provides single source of truth for creating CustomSessionResult objects
 */
import type { CustomSessionResult } from "../types/events.types";

/**
 * Utility factory for creating CustomSessionResult objects
 * Provides single source of truth for result creation logic
 */
export class CustomSessionResultFactory {
	/**
	 * Create result for current note session
	 */
	static createCurrentNoteResult(currentNoteName: string | null): CustomSessionResult {
		return {
			cancelled: false,
			sessionType: "current-note",
			sourceNoteFilter: currentNoteName ?? undefined,
			ignoreDailyLimits: true,
		};
	}

	/**
	 * Create result for today's cards session
	 */
	static createTodaysCardsResult(): CustomSessionResult {
		return {
			cancelled: false,
			sessionType: "created-today",
			createdTodayOnly: true,
			ignoreDailyLimits: true,
		};
	}

	/**
	 * Create result for default deck session
	 */
	static createDefaultDeckResult(): CustomSessionResult {
		return {
			cancelled: false,
			sessionType: "default",
			useDefaultDeck: true,
			ignoreDailyLimits: false,
		};
	}

	/**
	 * Create result for buried cards session
	 */
	static createBuriedCardsResult(): CustomSessionResult {
		return {
			cancelled: false,
			sessionType: "state-filter",
			stateFilter: "buried",
			ignoreDailyLimits: true,
			bypassScheduling: true,
		};
	}

	/**
	 * Create result for selected notes session
	 */
	static createSelectedNotesResult(noteFilters: string[]): CustomSessionResult {
		return {
			cancelled: false,
			sessionType: "select-notes",
			sourceNoteFilters: noteFilters,
			ignoreDailyLimits: true,
		};
	}

	/**
	 * Create result based on action type
	 * Convenience method for use with quick action handlers
	 */
	static createActionResult(
		action: "current-note" | "today" | "default" | "buried",
		currentNoteName: string | null
	): CustomSessionResult {
		switch (action) {
			case "current-note":
				return this.createCurrentNoteResult(currentNoteName);
			case "today":
				return this.createTodaysCardsResult();
			case "default":
				return this.createDefaultDeckResult();
			case "buried":
				return this.createBuriedCardsResult();
		}
	}

	/**
	 * Create cancelled result
	 */
	static createCancelledResult(): CustomSessionResult {
		return {
			cancelled: true,
			sessionType: null,
			ignoreDailyLimits: false,
		};
	}
}
