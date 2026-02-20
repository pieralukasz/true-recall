import type { Grade, State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "@shared/types";

export interface ReviewViewState extends Record<string, unknown> {
	projectFilters?: string[];
	// Custom session filters
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	createdThisWeek?: boolean;
	weakCardsOnly?: boolean;
	stateFilter?: "due" | "learning" | "new" | "buried";
	ignoreDailyLimits?: boolean;
	bypassScheduling?: boolean;
	// Advanced custom study filters
	difficultyRange?: { min: number; max: number };
	lapsesRange?: { min: number; max: number };
	stabilityRange?: { min: number; max: number };
	overdueOnly?: boolean;
	recentlyFailed?: boolean;
	cardLimit?: number;
	studyAheadDays?: number;
	reviewOrder?: import("@shared/types/settings.types").ReviewOrder;
	crammingMode?: boolean;
}

export interface UndoEntry {
	actionType: "answer" | "bury" | "suspend";
	card: FSRSFlashcardItem;
	originalFsrs: FSRSFlashcardItem["fsrs"];
	previousIndex: number;
	// Fields only for "answer" action
	wasNewCard?: boolean;
	rating?: Grade;
	previousState?: State;
	// Fields only for "bury" action (bury note can have multiple cards)
	additionalCards?: Array<{
		card: FSRSFlashcardItem;
		originalFsrs: FSRSFlashcardItem["fsrs"];
	}>;
}
