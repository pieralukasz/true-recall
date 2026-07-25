import { z } from "zod";

import type { CardFields } from "@true-recall/core/types/card-ai-preset.types";

// Re-export the persisted data shapes so consumers can import everything
// card-ai-related from this barrel without reaching into core's settings
// types directly.
export type {
	CardAIPreset,
	CardAIUserSettings,
	CardFields,
} from "@true-recall/core/types/card-ai-preset.types";

/** Whether a transform rewrites an existing card or drafts a new one. */
export type CardAIOperation = "edit" | "create";

export interface CardAIContext {
	sourceNotePath?: string;
	sourceNoteContent?: string;
	relatedCards?: Array<{ fields: CardFields; noteType: string }>;
}

export interface CardAIRequest {
	fields: CardFields;
	noteType: { name: string; fields: readonly string[] };
	prompt: string;
	operation: CardAIOperation;
	context?: CardAIContext;
	signal?: AbortSignal;
}

export interface CardAIResult {
	cards: CardFields[];
	rawResponse: string;
	usage: { promptTokens: number; completionTokens: number };
}

export function makeCardAIArrayResponseSchema(fieldNames: readonly string[]) {
	if (fieldNames.length === 0) {
		throw new Error(
			"makeCardAIArrayResponseSchema requires at least one field name",
		);
	}
	const shape: Record<string, z.ZodString> = {};
	for (const name of fieldNames) shape[name] = z.string();
	return z
		.array(z.object(shape).loose())
		.min(1)
		.transform((arr) =>
			arr.map((raw) => {
				const src = raw;
				const out: CardFields = {};
				for (const name of fieldNames) out[name] = src[name] ?? "";
				return out;
			}),
		);
}

// Compares two CardFields values after trimming whitespace per field.
// Used to decide whether the model produced a meaningful edit to [0].
// Trimming is intentional: trailing newlines or leading whitespace from the
// model do not constitute a semantic change and should not trigger preview UI.
export function deepEqualFields(a: CardFields, b: CardFields): boolean {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) {
		if ((a[k] ?? "").trim() !== (b[k] ?? "").trim()) return false;
	}
	return true;
}

export class CardAIParseError extends Error {
	constructor(
		public readonly rawResponse: string,
		message?: string,
	) {
		super(
			message ?? "Card AI response could not be parsed as the expected JSON",
		);
		this.name = "CardAIParseError";
	}
}

export class CardAIAbortedError extends Error {
	constructor() {
		super("Card AI request was aborted");
		this.name = "CardAIAbortedError";
	}
}

export class CardAIProviderError extends Error {
	constructor(
		message: string,
		public readonly cause: unknown,
	) {
		super(message);
		this.name = "CardAIProviderError";
	}
}
