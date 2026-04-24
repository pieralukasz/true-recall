import { Notice } from "obsidian";

import {
	AIRequestError,
	CardAIAbortedError,
	CardAIParseError,
	CardAIProviderError,
} from "@true-recall/core";

export interface CardAIErrorHooks {
	onRawFallback: (rawResponse: string) => void;
}

export function handleCardAIError(err: unknown, hooks: CardAIErrorHooks): void {
	if (err instanceof CardAIAbortedError) return;
	if (err instanceof CardAIParseError) {
		hooks.onRawFallback(err.rawResponse);
		return;
	}
	if (err instanceof CardAIProviderError) {
		const cause = err.cause;
		if (cause instanceof AIRequestError && cause.isRateLimited) {
			new Notice("AI: rate limit hit — try again later.");
			return;
		}
		if (cause instanceof AIRequestError && cause.isUnauthorized) {
			new Notice("AI: unauthorized — check your API key.");
			return;
		}
		new Notice(`AI failed: ${err.message}`);
		return;
	}
	const msg = err instanceof Error ? err.message : String(err);
	new Notice(`AI failed: ${msg}`);
}
