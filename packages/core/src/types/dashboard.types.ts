/**
 * Retrievability spread for a note or project, used by R-Mode surfaces.
 *
 * `sumR` is kept rather than a mean so parents can combine children without
 * averaging averages, which would over-weight small notes.
 */
export interface NoteRetrievability {
	/** R below the urgent threshold — actively being lost. */
	urgent: number;
	/** Between urgent and the retention target — slipping. */
	losing: number;
	/** Between the retention target and the ceiling — known. */
	known: number;
	/** Above the ceiling — a review would buy nothing. */
	fresh: number;
	/** urgent + losing + known: everything a session could draw from. */
	pool: number;
	/** Review-state cards counted. */
	total: number;
	/** Sum of R across those cards. */
	sumR: number;
}

export interface DashboardNoteEntry {
	name: string;
	path: string | null;
	due: number;
	newCount: number;
	/** Learning/Relearning cards whose next step is due now. */
	learning: number;
	/** Learning/Relearning cards waiting for a later step. */
	learningPending?: number;
	total: number;
	lastReview: string | null;
	overdueDays: number;
	overdueCount: number;
	estimatedMinutes: number;
	priority: NotePriority;
	projects: string[];
	presetName?: string;
	archived?: boolean;
	/** Present only when R-Mode is on; absent means the due-date view. */
	retrievability?: NoteRetrievability;
}

export type NotePriority = "overdue" | "hot" | "due" | "light" | "done";

export type NoteFilterMode =
	| "all"
	| "due"
	| "new"
	| "learning"
	| "overdue"
	/** R-Mode replacement for "due": notes with cards worth reviewing now. */
	| "pool";

export type DashboardTab = "projects" | "notes" | "custom" | "orphaned";

export interface DashboardProject {
	name: string;
	path: string;
	healthPct: number;
	newCount: number;
	/** Learning/Relearning cards whose next step is due now. */
	learning: number;
	/** Learning/Relearning cards waiting for a later step. */
	learningPending?: number;
	due: number;
	totalCards: number;
	childCount: number;
	lastReviewed: string | null;
	totalMembers: number;
	memberNotes: DashboardNoteEntry[];
	children: DashboardProject[];
	presetName?: string;
	archived?: boolean;
	/** Present only when R-Mode is on; absent means the due-date view. */
	retrievability?: NoteRetrievability;
}

export type ProjectFilter =
	| { type: "none" }
	| { type: "project"; name: string }
	| { type: "unassigned" };

export interface DashboardProjectAggregation {
	projects: DashboardProject[];
	noteProjectMap: Map<string, string[]>;
	recentlyStudied: DashboardNoteEntry[];
}

export interface TodayProgress {
	studied: number;
	minutes: number;
	newCards: number;
	newCardsCap: number;
	reviewCards: number;
	reviewsCap: number;
}

export interface OrphanedCardStats {
	total: number;
	new: number;
	learning: number;
	due: number;
}

export interface DashboardAggregation {
	notes: DashboardNoteEntry[];
	totalDue: number;
	/** Cards worth reviewing now. Present only when R-Mode is on. */
	totalPool?: number;
	totalNew: number;
	totalLearning: number;
	totalLearningPending?: number;
	totalOverdue: number;
	totalCards: number;
	streak: number;
	estimatedTotalMinutes: number;
	noteCount: number;
	todayProgress: TodayProgress;
	orphanedCards: OrphanedCardStats;
}
