import type { NoteType } from "@shared/types/note.types";

export function buildPlaceholder(noteType: NoteType | null): string {
	if (!noteType) {
		return "#type/basic\nFront: Question\nBack: Answer\n---";
	}

	const slug =
		noteType.slug ?? noteType.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const fieldLines = noteType.fields
		.map((f) => `${f}: [${f.toLowerCase()}]`)
		.join("\n");
	return `#type/${slug}\n${fieldLines}\n---`;
}
