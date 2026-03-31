import type { CardTemplate } from "@true-recall/core/types/note.types";

export interface NoteTypeDraft {
	name: string;
	type: 0 | 1;
	fields: string[];
	templates: CardTemplate[];
	css: string;
}

export function createDefaultDraft(): NoteTypeDraft {
	return {
		name: "",
		type: 0,
		fields: ["Front", "Back"],
		templates: [
			{
				name: "Card 1",
				ordinal: 0,
				qfmt: "{{Front}}",
				afmt: "{{Back}}",
			},
		],
		css: "",
	};
}
