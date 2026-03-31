import type { NoteType } from "@true-recall/core/types/note.types";
export declare function slugifyNoteTypeName(name: string): string;
/** Resolve slug for a NoteType: stored slug > builtin mapping > derived from name */
export declare function resolveSlug(noteType: NoteType): string;
