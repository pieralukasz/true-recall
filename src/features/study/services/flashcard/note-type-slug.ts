import type { NoteType } from "@shared/types/note.types";
import { BUILTIN_SLUGS } from "@shared/types/note.types";

export function slugifyNoteTypeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Resolve slug for a NoteType: stored slug > builtin mapping > derived from name */
export function resolveSlug(noteType: NoteType): string {
	return (
		noteType.slug ??
		BUILTIN_SLUGS[noteType.id] ??
		slugifyNoteTypeName(noteType.name)
	);
}
