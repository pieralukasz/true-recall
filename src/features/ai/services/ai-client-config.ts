import { LITELLM_PROXY_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	proxyUrl: string | undefined;
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (settings.subscriptionKey) {
		return {
			apiKey: settings.subscriptionKey,
			model: settings.aiModel,
			proxyUrl: LITELLM_PROXY_URL,
		};
	}

	if (!settings.openRouterApiKey) {
		throw new Error(
			"No AI key configured. Add a subscription key or your own OpenRouter API key in settings.",
		);
	}

	return {
		apiKey: settings.openRouterApiKey,
		model: settings.aiModel,
		proxyUrl: undefined,
	};
}
