import type { CardFields } from "@true-recall/core";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import type { CardAITarget, CardAITargetOperation } from "./card-ai";

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

	getCurrentCardId(): string | undefined {
		return this.snapshot().card?.id;
	}

	getOperation(): CardAITargetOperation {
		return "edit";
	}

	apply(fields: CardFields): boolean {
		const { card } = this.snapshot();
		if (!card || !card.noteId) return false;
		this.plugin.flashcardManager.updateNoteFields(card.noteId, fields);
		return true;
	}

	createCard(fields: CardFields): string[] | null {
		const { card, noteType } = this.snapshot();
		if (!card || !noteType) return null;
		const result = this.plugin.flashcardManager.createNote({
			noteTypeId: noteType.id,
			fields,
			sourceUid: card.sourceUid,
			createdVia: "ai_polish",
		});
		return result.cards.length > 0 ? result.cards.map((c) => c.id) : null;
	}

	removeCard(cardId: string): boolean {
		return this.plugin.flashcardManager.removeFlashcardById(cardId);
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
