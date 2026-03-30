import { type DailyNoteInfo } from "./daily-note-preprocessor";
export interface RagChunk {
    content: string;
    headingBreadcrumb: string;
    index: number;
    tokenCount: number;
}
export declare function chunkNote(rawContent: string): RagChunk[];
export declare function chunkDailyNote(rawContent: string, dailyInfo: DailyNoteInfo, excludeHeadings: string[]): RagChunk[];
export declare function chunkFlashcard(fieldsJson: string, sourceText?: string, tags?: string): RagChunk[];
