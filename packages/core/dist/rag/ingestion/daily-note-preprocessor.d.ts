export interface DailyNoteInfo {
    isDailyNote: boolean;
    date: string | null;
    displayDate: string | null;
    dayOfWeek: string | null;
}
/**
 * Preprocess daily note content: filter low-quality paragraphs,
 * remove excluded heading sections, and prepend date context.
 */
export declare function preprocessDailyNote(filtered: string, dailyInfo: DailyNoteInfo, excludeHeadings: string[]): string;
