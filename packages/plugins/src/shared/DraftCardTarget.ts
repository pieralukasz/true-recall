import type { CardAITarget, CardFields } from "@true-recall/core";

export interface DraftCardTargetDetail {
	fields: CardFields;
	noteType: { id: string; name: string; fields: string[] };
	sourceUid: string;
	currentCardId: string | null;
	onApply: (fields: CardFields) => void;
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

	getCurrentCardId(): string | null {
		return this.detail.currentCardId;
	}

	apply(fields: CardFields): void {
		const valid = new Set(this.detail.noteType.fields);
		const filtered: CardFields = {};
		for (const [k, v] of Object.entries(fields)) {
			if (valid.has(k)) filtered[k] = v;
		}
		this.detail.onApply(filtered);
	}
}
