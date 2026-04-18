import { z } from "zod";

export interface CardPolishPreset {
	id: string;
	name: string;
	prompt: string;
	autoApply: boolean;
	hotkey?: string;
	builtin: boolean;
	modelOverride?: string;
}

export interface CardPolishSettings {
	presets: CardPolishPreset[];
	customPromptAutoApply: boolean;
}

export interface PolishRequest {
	cardFront: string;
	cardBack: string;
	prompt: string;
	modelOverride?: string;
	signal?: AbortSignal;
}

export interface PolishResult {
	front: string;
	back: string;
	rawResponse: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		costUsd?: number;
	};
}

export const PolishResponseSchema = z.object({
	front: z.string().min(1),
	back: z.string().min(1),
});

export class PolishParseError extends Error {
	constructor(
		public readonly rawResponse: string,
		message?: string,
	) {
		super(
			message ?? "Polish response could not be parsed as the expected JSON",
		);
		this.name = "PolishParseError";
	}
}

export class PolishAbortedError extends Error {
	constructor() {
		super("Polish request was aborted");
		this.name = "PolishAbortedError";
	}
}

export class PolishProviderError extends Error {
	constructor(
		message: string,
		public readonly cause: unknown,
	) {
		super(message);
		this.name = "PolishProviderError";
	}
}
