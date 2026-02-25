import { LITELLM_PROXY_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	proxyUrl: string | undefined;
	userId?: string;
}

/**
 * Resolves which AI backend to use:
 * - Subscription key present → route through LiteLLM proxy
 * - Otherwise → direct to OpenRouter with BYOK key
 *
 * The cached `isSubscriber` flag is used by UI/init code to know
 * subscription state instantly on startup (no async call needed).
 * This function uses the key directly since it's always available
 * from settings when a subscription is active.
 */
export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (settings.subscriptionKey) {
		return {
			apiKey: settings.subscriptionKey,
			model: settings.aiModel,
			proxyUrl: LITELLM_PROXY_URL,
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
		model: settings.aiModel,
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
		model: settings.aiModel,
		proxyUrl: undefined,
	};
}
