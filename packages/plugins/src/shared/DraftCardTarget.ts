import type { CardFields } from "@true-recall/core";

import type { CardAITarget, CardAITargetOperation } from "./card-ai";

// Minimal structural type instead of importing FlashcardManager from
// `@true-recall/core/flashcard`. The deep import causes Vitest to eagerly
// load core's flashcard module (which transitively pulls sqlite-wasm),
// breaking unrelated tests that share the bundle. We only need two methods.
interface FlashcardManagerSubset {
	createNote(params: {
		noteTypeId: string;
		fields: CardFields;
		sourceUid?: string;
		createdVia?: string;
	}): { cards: { id: string }[] };
	removeFlashcardById(cardId: string): boolean;
}

export interface DraftCardTargetDetail {
	fields: CardFields;
	noteType: { id: string; name: string; fields: string[] };
	sourceUid: string;
	currentCardId: string | null;
	operation: CardAITargetOperation;
	onApply: (fields: CardFields) => void;
	flashcardManager: FlashcardManagerSubset;
}

export class DraftCardTarget implements CardAITarget {
	constructor(private readonly detail: DraftCardTargetDetail) {}

	getFields(): CardFields {
		return this.detail.fields;
	}

	getNoteType() {
		return this.detail.noteType;
	}

	getSourceUid(): string | undefined {
		return this.detail.sourceUid;
	}

	getCurrentCardId(): string | undefined {
		return this.detail.currentCardId ?? undefined;
	}

	getOperation(): CardAITargetOperation {
		return this.detail.operation;
	}

	apply(fields: CardFields): boolean {
		const valid = new Set(this.detail.noteType.fields);
		const filtered: CardFields = {};
		for (const [k, v] of Object.entries(fields)) {
			if (valid.has(k)) filtered[k] = v;
		}
		this.detail.onApply(filtered);
		return true;
	}

	createCard(fields: CardFields): string[] | null {
		const valid = new Set(this.detail.noteType.fields);
		const filtered: CardFields = {};
		for (const [k, v] of Object.entries(fields)) {
			if (valid.has(k)) filtered[k] = v;
		}
		const result = this.detail.flashcardManager.createNote({
			noteTypeId: this.detail.noteType.id,
			fields: filtered,
			sourceUid: this.detail.sourceUid,
			createdVia: "ai_polish",
		});
		return result.cards.length > 0 ? result.cards.map((c) => c.id) : null;
	}

	removeCard(cardId: string): boolean {
		return this.detail.flashcardManager.removeFlashcardById(cardId);
	}
}
