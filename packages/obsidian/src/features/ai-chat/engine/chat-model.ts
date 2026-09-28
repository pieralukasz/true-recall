import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { buildAIHeaders } from "@true-recall/core/ai/clients/openrouter-client";
import {
	type AIClientConfig,
	resolveAIClientConfig,
} from "@true-recall/core/ai/config/ai-client-config";
import type { TrueRecallSettings } from "@true-recall/core/types";

/** The provider name doubles as the providerOptions key for extra body fields. */
export const CHAT_PROVIDER_NAME = "truerecall";

/** Settings store the full chat-completions URL; the SDK appends the path itself. */
export function toBaseURL(url: string): string {
	return url
		.trim()
		.replace(/\/+$/, "")
		.replace(/\/chat\/completions$/, "");
}

export function supportsWebSearch(
	providerType: AIClientConfig["providerType"],
): boolean {
	return providerType === "openrouter" || providerType === "pro";
}

export interface ChatModel {
	model: LanguageModel;
	config: AIClientConfig;
}

/** Every provider True Recall supports speaks the OpenAI chat-completions API. */
export function createChatModel(
	settings: TrueRecallSettings,
	fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): ChatModel {
	const config = resolveAIClientConfig(settings, "assistant");
	const {
		Authorization: _auth,
		"Content-Type": _type,
		...headers
	} = buildAIHeaders(config.apiKey, {
		providerType: config.providerType,
		capability: "assistant",
	});
	const provider = createOpenAICompatible({
		name: CHAT_PROVIDER_NAME,
		baseURL: toBaseURL(config.baseUrl),
		apiKey: config.apiKey,
		headers,
		// Bun's fetch type adds `preconnect`; the SDK only calls it.
		fetch: fetch as typeof globalThis.fetch,
		includeUsage: true,
	});
	return { model: provider.chatModel(config.model), config };
}
