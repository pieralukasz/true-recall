import type { AITier, TrueRecallSettings } from "@shared/types/settings.types";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const PORTKEY_BASE_URL = "https://api.portkey.ai/v1/chat/completions";
const PORTKEY_MODEL = "google/gemini-2.5-flash";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	proxyUrl: string | undefined;
	tier: AITier;
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (settings.aiTier === "pro") {
		if (
			settings.proSubscriptionStatus === "active" &&
			settings.portkeyVirtualKey
		) {
			return {
				apiKey: settings.portkeyVirtualKey,
				model: PORTKEY_MODEL,
				proxyUrl: PORTKEY_BASE_URL,
				tier: "pro",
			};
		}

		// Pro not active — fall back to BYOK if key exists
		if (settings.openRouterApiKey) {
			return {
				apiKey: settings.openRouterApiKey,
				model: DEFAULT_MODEL,
				proxyUrl: undefined,
				tier: "byok",
			};
		}

		throw new Error(
			"True Recall Pro subscription is not active and no OpenRouter API key is configured.",
		);
	}

	// BYOK tier
	if (!settings.openRouterApiKey) {
		throw new Error(
			"No AI key configured. Add your OpenRouter API key in settings.",
		);
	}

	return {
		apiKey: settings.openRouterApiKey,
		model: DEFAULT_MODEL,
		proxyUrl: undefined,
		tier: "byok",
	};
}
