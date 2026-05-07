import type {
	CardAITarget,
	CardAITargetOperation,
	CardFields,
} from "@true-recall/core";

export interface DraftCardTargetDetail {
	fields: CardFields;
	noteType: { id: string; name: string; fields: string[] };
	sourceUid: string;
	currentCardId: string | null;
	operation: CardAITargetOperation;
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
}
