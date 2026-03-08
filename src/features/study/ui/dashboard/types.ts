export interface DashboardNoteEntry {
	name: string;
	path: string | null;
	due: number;
	newCount: number;
	learning: number;
	total: number;
	lastReview: string | null;
	overdueDays: number;
	overdueCount: number;
	estimatedMinutes: number;
	priority: NotePriority;
	projects: string[];
	presetName?: string;
	archived?: boolean;
}

export type NotePriority = "overdue" | "hot" | "due" | "light" | "done";

export type NoteFilterMode = "all" | "due" | "new" | "learning" | "overdue";

export type DashboardTab = "projects" | "notes";

export interface DashboardProject {
	name: string;
	path: string;
	healthPct: number;
	newCount: number;
	learning: number;
	due: number;
	totalCards: number;
	childCount: number;
	lastReviewed: string | null;
	totalMembers: number;
	memberNotes: DashboardNoteEntry[];
	children: DashboardProject[];
	presetName?: string;
	archived?: boolean;
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
	totalNew: number;
	totalLearning: number;
	totalOverdue: number;
	totalCards: number;
	streak: number;
	estimatedTotalMinutes: number;
	noteCount: number;
	todayProgress: TodayProgress;
	orphanedCards: OrphanedCardStats;
}
