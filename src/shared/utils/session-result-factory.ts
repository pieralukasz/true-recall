/**
 * Session Result Factory
 * Provides single source of truth for creating SessionResult objects
 */
import type { SessionResult } from "@shared/types/events.types";

function createCurrentNoteResult(
	currentNoteName: string | null,
): SessionResult {
	return {
		cancelled: false,
		sessionType: "current-note",
		sourceNoteFilter: currentNoteName ?? undefined,
		ignoreDailyLimits: true,
	};
}

function createTodaysCardsResult(): SessionResult {
	return {
		cancelled: false,
		sessionType: "created-today",
		createdTodayOnly: true,
		ignoreDailyLimits: true,
	};
}

function createDefaultDeckResult(): SessionResult {
	return {
		cancelled: false,
		sessionType: "default",
		useDefaultDeck: true,
		ignoreDailyLimits: false,
	};
}

function createBuriedCardsResult(): SessionResult {
	return {
		cancelled: false,
		sessionType: "state-filter",
		stateFilter: "buried",
		ignoreDailyLimits: true,
		bypassScheduling: true,
	};
}

function createSelectedNotesResult(noteFilters: string[]): SessionResult {
	return {
		cancelled: false,
		sessionType: "select-notes",
		sourceNoteFilters: noteFilters,
		ignoreDailyLimits: true,
	};
}

function createActionResult(
	action: "current-note" | "today" | "default" | "buried",
	currentNoteName: string | null,
): SessionResult {
	switch (action) {
		case "current-note":
			return createCurrentNoteResult(currentNoteName);
		case "today":
			return createTodaysCardsResult();
		case "default":
			return createDefaultDeckResult();
		case "buried":
			return createBuriedCardsResult();
	}
}

function createFailedCardsResult(): SessionResult {
	return {
		cancelled: false,
		sessionType: "custom-study",
		recentlyFailed: true,
		bypassScheduling: true,
		ignoreDailyLimits: true,
	};
}

function createDifficultCardsResult(): SessionResult {
	return {
		cancelled: false,
		sessionType: "custom-study",
		difficultyRange: { min: 7, max: 10 },
		bypassScheduling: true,
		ignoreDailyLimits: true,
	};
}

function createStudyAheadResult(days: number = 3): SessionResult {
	return {
		cancelled: false,
		sessionType: "custom-study",
		studyAheadDays: days,
		bypassScheduling: true,
		reviewOrder: "due-date",
		ignoreDailyLimits: true,
	};
}

function createMostForgottenResult(limit: number = 50): SessionResult {
	return {
		cancelled: false,
		sessionType: "custom-study",
		reviewOrder: "most-lapses",
		cardLimit: limit,
		bypassScheduling: true,
		ignoreDailyLimits: true,
	};
}

function createCancelledResult(): SessionResult {
	return {
		cancelled: true,
		sessionType: null,
		ignoreDailyLimits: false,
	};
}

export const SessionResultFactory = {
	createCurrentNoteResult,
	createTodaysCardsResult,
	createDefaultDeckResult,
	createBuriedCardsResult,
	createSelectedNotesResult,
	createActionResult,
	createFailedCardsResult,
	createDifficultCardsResult,
	createStudyAheadResult,
	createMostForgottenResult,
	createCancelledResult,
};
