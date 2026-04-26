/**
 * Note Types — Anki-compatible notes + cards separation model.
 *
 * A NoteType defines the schema (fields + templates).
 * A Note holds field values for a specific NoteType.
 * Cards are generated from Notes via templates and scheduled independently.
 */
// ── Built-in note type IDs (deterministic, not UUIDs) ──
export const BUILTIN_BASIC_ID = "builtin-basic";
export const BUILTIN_BASIC_REVERSED_ID = "builtin-basic-reversed";
export const BUILTIN_CLOZE_ID = "builtin-cloze";
export const BUILTIN_IMAGE_OCCLUSION_ID = "builtin-image-occlusion";
export const BUILTIN_NOTE_REVIEW_ID = "builtin-note-review";
// ── Built-in note type slugs (used in #type/<slug> block format) ──
export const BUILTIN_SLUGS = {
    [BUILTIN_BASIC_ID]: "basic",
    [BUILTIN_BASIC_REVERSED_ID]: "basic-reversed",
    [BUILTIN_CLOZE_ID]: "cloze",
    [BUILTIN_IMAGE_OCCLUSION_ID]: "image-occlusion",
    [BUILTIN_NOTE_REVIEW_ID]: "note-review",
};
