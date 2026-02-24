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
}

export type NotePriority = "overdue" | "hot" | "due" | "light" | "done";

export type NoteFilterMode = "all" | "due" | "new" | "learning" | "overdue";

export interface TodayProgress {
	studied: number;
	minutes: number;
	newCards: number;
	newCardsCap: number;
	reviewCards: number;
	reviewsCap: number;
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
}
