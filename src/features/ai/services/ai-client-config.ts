import { AI_PROXY_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";

const MANAGED_DEFAULT_MODEL = "google/gemini-3-flash-preview";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	proxyUrl: string | undefined;
	userId?: string;
}

/**
 * Resolves which AI backend to use:
 * - Subscription key present → route through managed proxy
 * - Otherwise → direct to OpenRouter with BYOK key
 */
export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (settings.subscriptionKey) {
		return {
			apiKey: settings.subscriptionKey,
			model: "auto",
			proxyUrl: AI_PROXY_URL,
			userId: settings.userId,
		};
	}

	if (!settings.openRouterApiKey) {
		throw new Error(
			"No AI key configured. Add a subscription key or your own OpenRouter API key in settings.",
		);
	}

	return {
		apiKey: settings.openRouterApiKey,
		model: MANAGED_DEFAULT_MODEL,
		proxyUrl: undefined,
	};
}

/**
 * Returns a BYOK OpenRouter config if available, for 429 fallback.
 * When the subscription budget is exceeded, we can fall back to
 * the user's own OpenRouter key if they have one configured.
 */
export function getBYOKFallbackConfig(
	settings: TrueRecallSettings,
): AIClientConfig | null {
	if (!settings.openRouterApiKey) return null;

	return {
		apiKey: settings.openRouterApiKey,
		model: MANAGED_DEFAULT_MODEL,
		proxyUrl: undefined,
	};
}
