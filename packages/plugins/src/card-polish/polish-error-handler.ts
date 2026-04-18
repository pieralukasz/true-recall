import { Notice } from "obsidian";

import {
	AIRequestError,
	PolishAbortedError,
	PolishParseError,
	PolishProviderError,
} from "@true-recall/core";

export interface PolishErrorHooks {
	onRawFallback: (rawResponse: string) => void;
}

export function handlePolishError(err: unknown, hooks: PolishErrorHooks): void {
	if (err instanceof PolishAbortedError) return;
	if (err instanceof PolishParseError) {
		hooks.onRawFallback(err.rawResponse);
		return;
	}
	if (err instanceof PolishProviderError) {
		const cause = err.cause;
		if (cause instanceof AIRequestError && cause.isRateLimited) {
			new Notice("Polish: rate limit hit — try again later.");
			return;
		}
		if (cause instanceof AIRequestError && cause.isUnauthorized) {
			new Notice("Polish: unauthorized — check your API key.");
			return;
		}
		new Notice(`Polish failed: ${err.message}`);
		return;
	}
	const msg = err instanceof Error ? err.message : String(err);
	new Notice(`Polish failed: ${msg}`);
}
