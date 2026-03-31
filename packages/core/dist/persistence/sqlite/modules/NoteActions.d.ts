/**
 * Note Actions Module
 * CRUD operations for notes table
 */
import type { SqliteDatabase } from "../SqliteDatabase";
import type { Note } from "../../../types/note.types";
/** Escape user input for FTS5 MATCH — wraps in double quotes to treat as phrase */
export declare function escapeFts5Query(input: string): string;
export declare class NoteActions {
    private db;
    private fts5Available;
    constructor(db: SqliteDatabase);
    isFts5Available(): boolean;
    getById(id: string): Note | null;
    getBySourceUid(sourceUid: string): Note[];
    getByNoteTypeId(noteTypeId: string): Note[];
    create(note: Note): void;
    update(id: string, updates: Partial<Note>): void;
    delete(id: string): void;
    count(): number;
    countByNoteType(noteTypeId: string): number;
    search(query: string): Note[];
}
