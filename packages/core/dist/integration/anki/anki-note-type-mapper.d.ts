import type { AnkiModel, ModelMapping, NoteTypeMapping } from "@true-recall/core/types";
import type { NoteType } from "@true-recall/core/types/note.types";
export interface NoteTypeStore {
    getAll(): NoteType[];
    getBySlug(slug: string): NoteType | null;
    create(noteType: NoteType): void;
}
export declare class AnkiNoteTypeMapper {
    private noteTypeStore;
    private modelToNoteType;
    private created;
    constructor(noteTypeStore: NoteTypeStore);
    get noteTypesCreated(): number;
    suggestMappings(models: Map<number, AnkiModel>, cardCountByModel?: Map<number, number>): NoteTypeMapping[];
    mapModels(models: Map<number, AnkiModel>, overrides?: Map<number, ModelMapping>): void;
    getNoteTypeId(ankiModelId: number): string | undefined;
    private findExistingMatch;
    private resolveNoteType;
    private matchBuiltin;
    private createFromAnkiModel;
}
/**
 * Strip HTML wrapper tags from Anki templates while preserving
 * {{FieldName}}, {{cloze:FieldName}}, {{FrontSide}}, {{#Field}}...{{/Field}} references.
 */
export declare function stripHtmlFromTemplate(template: string): string;
