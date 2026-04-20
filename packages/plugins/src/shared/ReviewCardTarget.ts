import type { CardAITarget, CardFields } from "@true-recall/core";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

export class ReviewCardTarget implements CardAITarget {
	constructor(private readonly plugin: TrueRecallPlugin) {}

	getFields(): CardFields {
		const { note, noteType } = this.snapshot();
		if (!note || !noteType) return {};
		const out: CardFields = {};
		for (const f of noteType.fields) out[f] = note.fields?.[f] ?? "";
		return out;
	}

	getNoteType() {
		return this.snapshot().noteType ?? { id: "", name: "", fields: [] };
	}

	getSourceUid(): string | undefined {
		return this.snapshot().card?.sourceUid;
	}

	getCurrentCardId(): string | null {
		return this.snapshot().card?.id ?? null;
	}

	apply(fields: CardFields): void {
		const { card } = this.snapshot();
		if (!card || !card.noteId) return;
		this.plugin.flashcardManager.updateNoteFields(card.noteId, fields);
	}

	private snapshot() {
		const card = this.plugin.store?.getState().review?.getCurrentCard() ?? null;
		const note = card?.noteId
			? (this.plugin.cardStore?.notes?.getById(card.noteId) ?? null)
			: null;
		const noteType = note
			? (this.plugin.cardStore?.noteTypes?.getById(note.noteTypeId) ?? null)
			: null;
		return { card, noteType, note };
	}
}
