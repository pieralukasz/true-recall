/**
 * Session Result Factory
 * Provides single source of truth for creating SessionResult objects
 */
import type { SessionResult } from "../types/events.types";

/**
 * Utility factory for creating SessionResult objects
 * Provides single source of truth for result creation logic
 */
export class SessionResultFactory {
	/**
	 * Create result for current note session
	 */
	static createCurrentNoteResult(currentNoteName: string | null): SessionResult {
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
	static createTodaysCardsResult(): SessionResult {
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
	static createDefaultDeckResult(): SessionResult {
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
	static createBuriedCardsResult(): SessionResult {
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
	static createSelectedNotesResult(noteFilters: string[]): SessionResult {
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
	): SessionResult {
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

	static createFailedCardsResult(): SessionResult {
		return {
			cancelled: false,
			sessionType: "custom-study",
			recentlyFailed: true,
			bypassScheduling: true,
			ignoreDailyLimits: true,
		};
	}

	static createDifficultCardsResult(): SessionResult {
		return {
			cancelled: false,
			sessionType: "custom-study",
			difficultyRange: { min: 7, max: 10 },
			bypassScheduling: true,
			ignoreDailyLimits: true,
		};
	}

	static createStudyAheadResult(days: number = 3): SessionResult {
		return {
			cancelled: false,
			sessionType: "custom-study",
			studyAheadDays: days,
			bypassScheduling: true,
			reviewOrder: "due-date",
			ignoreDailyLimits: true,
		};
	}

	static createMostForgottenResult(limit: number = 50): SessionResult {
		return {
			cancelled: false,
			sessionType: "custom-study",
			reviewOrder: "most-lapses",
			cardLimit: limit,
			bypassScheduling: true,
			ignoreDailyLimits: true,
		};
	}

	static createCancelledResult(): SessionResult {
		return {
			cancelled: true,
			sessionType: null,
			ignoreDailyLimits: false,
		};
	}
}
