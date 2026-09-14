import { OpenRouterClient } from "@true-recall/core/ai/clients/openrouter-client";
import type { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";

import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";

/** Only the OpenRouter-backed providers forward the web search plugin. */
export function supportsWebSearch(
	providerType: ReturnType<typeof resolveAIClientConfig>["providerType"],
): boolean {
	return providerType === "openrouter" || providerType === "pro";
}

export function createAssistantClient(
	config: ReturnType<typeof resolveAIClientConfig>,
): OpenRouterClient {
	return new OpenRouterClient(
		config.apiKey,
		config.model,
		new ObsidianHttpClient(),
		config.baseUrl,
		undefined,
		"assistant",
		{ providerType: config.providerType },
	);
}
