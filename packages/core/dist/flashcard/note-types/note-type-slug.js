import { BUILTIN_SLUGS } from "@true-recall/core/types/note.types";
export function slugifyNoteTypeName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/** Resolve slug for a NoteType: stored slug > builtin mapping > derived from name */
export function resolveSlug(noteType) {
    var _a, _b;
    return ((_b = (_a = noteType.slug) !== null && _a !== void 0 ? _a : BUILTIN_SLUGS[noteType.id]) !== null && _b !== void 0 ? _b : slugifyNoteTypeName(noteType.name));
}
