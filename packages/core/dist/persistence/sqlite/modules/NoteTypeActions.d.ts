/**
 * NoteType Actions Module
 * CRUD operations for note_types table
 */
import type { SqliteDatabase } from "../SqliteDatabase";
import type { NoteType } from "../../../types/note.types";
export declare class NoteTypeActions {
    private db;
    constructor(db: SqliteDatabase);
    getById(id: string): NoteType | null;
    getBySlug(slug: string): NoteType | null;
    getAll(): NoteType[];
    create(noteType: NoteType): void;
    update(id: string, updates: Partial<NoteType>): void;
    delete(id: string): void;
    seedBuiltinTypes(): void;
    refreshBuiltins(): void;
}
export declare function getBuiltinNoteTypes(): NoteType[];
