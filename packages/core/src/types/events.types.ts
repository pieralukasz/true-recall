export interface SessionResult {
	cancelled: boolean;
	sessionType:
		| "current-note"
		| "created-today"
		| "select-notes"
		| "state-filter"
		| "default"
		| "custom-study"
		| null;
	sourceNoteFilter?: string;
	sourceNoteFilters?: string[];
	filePathFilter?: string;
	createdTodayOnly?: boolean;
	ignoreDailyLimits: boolean;
	useDefaultDeck?: boolean;
	bypassScheduling?: boolean;
	stateFilter?: "due" | "learning" | "new" | "buried";
	// Advanced custom study filters
	difficultyRange?: { min: number; max: number };
	lapsesRange?: { min: number; max: number };
	stabilityRange?: { min: number; max: number };
	overdueOnly?: boolean;
	recentlyFailed?: boolean;
	cardLimit?: number;
	studyAheadDays?: number;
	reviewOrder?: import("./settings.types").ReviewOrder;
	crammingMode?: boolean;
}
