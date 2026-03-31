import type { NotePriority } from "./types";
export declare const PRIORITY_DOT: Record<NotePriority, string>;
export declare function computePriority(note: {
    overdueCount: number;
    due: number;
    learning: number;
    newCount: number;
}): NotePriority;
export declare function estimateStudyMinutes(due: number, newCount: number, learning: number): number;
export declare function formatEstimatedTime(minutes: number): string;
