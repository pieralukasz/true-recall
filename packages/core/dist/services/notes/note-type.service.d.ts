/**
 * NoteType Service
 *
 * Business logic for note type CRUD operations.
 * Handles validation, built-in type management, field/template operations,
 * and cascading updates to notes and cards.
 */
import type { CardTemplate, NoteType } from "../../types/note.types";
export interface NoteTypeServiceDeps {
    noteTypeActions: {
        getById(id: string): NoteType | null;
        getBySlug(slug: string): NoteType | null;
        getAll(): NoteType[];
        create(noteType: NoteType): void;
        update(id: string, updates: Partial<NoteType>): void;
        delete(id: string): void;
        seedBuiltinTypes(): void;
    };
    noteActions: {
        getByNoteTypeId(noteTypeId: string): {
            id: string;
        }[];
        countByNoteType(noteTypeId: string): number;
    };
}
export declare class NoteTypeService {
    private deps;
    constructor(deps: NoteTypeServiceDeps);
    initialize(): void;
    getById(id: string): NoteType | null;
    getAll(): NoteType[];
    getBySlug(slug: string): NoteType | null;
    create(input: {
        name: string;
        type?: 0 | 1;
        fields: string[];
        templates: CardTemplate[];
        css?: string;
        slug?: string;
    }): NoteType;
    update(id: string, updates: Partial<Pick<NoteType, "name" | "fields" | "templates" | "css">>): void;
    delete(id: string): void;
    addField(noteTypeId: string, fieldName: string): void;
    removeField(noteTypeId: string, fieldName: string): void;
    renameField(noteTypeId: string, oldName: string, newName: string): void;
}
