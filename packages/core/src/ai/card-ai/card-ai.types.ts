import { z } from "zod";

export type CardFields = Record<string, string>;

export interface CardAIContext {
	sourceNotePath?: string;
	sourceNoteContent?: string;
	relatedCards?: Array<{ fields: CardFields; noteType: string }>;
}

export interface CardAIRequest {
	fields: CardFields;
	prompt: string;
	context?: CardAIContext;
	signal?: AbortSignal;
}

export interface CardAIResult {
	fields: CardFields;
	rawResponse: string;
	usage: { promptTokens: number; completionTokens: number };
}

export interface CardAIPreset {
	id: string;
	name: string;
	prompt: string;
	autoApply: boolean;
	builtin: boolean;
	hotkey?: string;
	modelOverride?: string;
	requiresPro?: boolean;
	includeSourceNote?: boolean;
	includeRelatedCards?: boolean;
}

export interface CardAIUserSettings {
	userPresets: CardAIPreset[];
	customPromptAutoApply: boolean;
}

export function makeCardAIResponseSchema(fieldNames: readonly string[]) {
	if (fieldNames.length === 0) {
		throw new Error(
			"makeCardAIResponseSchema requires at least one field name",
		);
	}
	const shape: Record<string, z.ZodString> = {};
	for (const name of fieldNames) shape[name] = z.string();
	return z
		.object(shape)
		.passthrough()
		.transform((raw) => {
			// Zod.object validated all keys before this transform runs, so the
			// cast is safe and every name is guaranteed to be present.
			const src = raw as Record<string, string>;
			const out: CardFields = {};
			for (const name of fieldNames) out[name] = src[name] as string;
			return out;
		});
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
