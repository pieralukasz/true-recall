import type { DashboardNoteEntry, NotePriority } from "@true-recall/core/types/dashboard.types";
export declare const PRIORITY_DOT: Record<NotePriority, string>;
export declare function computePriority(note: {
    overdueCount: number;
    due: number;
    learning: number;
    newCount: number;
}): NotePriority;
export declare function prioritySortComparator(a: DashboardNoteEntry, b: DashboardNoteEntry): number;
