import type { ReviewOrder } from "./settings.types";

interface SessionConfigBase {
	reviewOrder?: ReviewOrder;
	cardLimit?: number;
}

export type SessionConfig =
	| (SessionConfigBase & { mode: "all_due" })
	| (SessionConfigBase & { mode: "note"; sourceUid: string })
	| (SessionConfigBase & {
			mode: "notes";
			noteNames: string[];
			dueOnly?: boolean;
			projectPath?: string;
	  })
	| (SessionConfigBase & { mode: "project"; projectPath: string })
	| (SessionConfigBase & { mode: "created_today" })
	| (SessionConfigBase & {
			mode: "weak_cards";
			sourceNoteFilter?: string;
	  })
	| (SessionConfigBase & { mode: "overdue" })
	| (SessionConfigBase & { mode: "study_ahead"; days: number })
	| (SessionConfigBase & {
			mode: "custom";
			sourceUidFilter?: string;
			sourceNoteFilter?: string;
			sourceNoteFilters?: string[];
			filePathFilter?: string;
			projectPath?: string;
			createdTodayOnly?: boolean;
			createdThisWeek?: boolean;
			weakCardsOnly?: boolean;
			stateFilter?: "due" | "learning" | "new" | "buried";
			ignoreDailyLimits?: boolean;
			bypassScheduling?: boolean;
			difficultyRange?: { min: number; max: number };
			lapsesRange?: { min: number; max: number };
			stabilityRange?: { min: number; max: number };
			overdueOnly?: boolean;
			recentlyFailed?: boolean;
			studyAheadDays?: number;
			crammingMode?: boolean;
	  });
