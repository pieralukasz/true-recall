/**
 * Note Types — Anki-compatible notes + cards separation model.
 *
 * A NoteType defines the schema (fields + templates).
 * A Note holds field values for a specific NoteType.
 * Cards are generated from Notes via templates and scheduled independently.
 */
export interface CardTemplate {
    name: string;
    ordinal: number;
    /** Front template, e.g. "{{Front}}" */
    qfmt: string;
    /** Back template, e.g. "{{Back}}" */
    afmt: string;
}
export interface NoteType {
    id: string;
    name: string;
    /** 0 = standard, 1 = cloze */
    type: 0 | 1;
    /** Ordered field names, e.g. ["Front", "Back"] */
    fields: string[];
    templates: CardTemplate[];
    css: string;
    isBuiltin: boolean;
    /** URL-safe identifier for #type/<slug> in block format. Stored in DB for stability across renames. */
    slug?: string;
    createdAt?: number;
    updatedAt?: number;
}
export interface Note {
    id: string;
    noteTypeId: string;
    /** Field name → value, e.g. { Front: "What is X?", Back: "X is..." } */
    fields: Record<string, string>;
    tags: string[];
    sourceUid?: string;
    sourceText?: string;
    createdVia?: string;
    createdAt?: number;
    updatedAt?: number;
}
export declare const BUILTIN_BASIC_ID = "builtin-basic";
export declare const BUILTIN_BASIC_REVERSED_ID = "builtin-basic-reversed";
export declare const BUILTIN_CLOZE_ID = "builtin-cloze";
export declare const BUILTIN_IMAGE_OCCLUSION_ID = "builtin-image-occlusion";
export declare const BUILTIN_NOTE_REVIEW_ID = "builtin-note-review";
export declare const BUILTIN_SLUGS: Record<string, string>;
