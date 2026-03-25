import { LITELLM_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { OPENROUTER_URL } from "./openrouter-client";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (settings.proKey) {
		return {
			apiKey: settings.proKey,
			model: settings.aiModel || DEFAULT_MODEL,
			baseUrl: LITELLM_URL,
		};
	}

	if (settings.openRouterApiKey) {
		return {
			apiKey: settings.openRouterApiKey,
			model: settings.aiModel || DEFAULT_MODEL,
			baseUrl: OPENROUTER_URL,
		};
	}

	throw new Error(
		"No AI key configured. Add your Pro key or OpenRouter API key in settings.",
	);
}

export function hasAIKey(settings: TrueRecallSettings): boolean {
	return !!(settings.proKey || settings.openRouterApiKey);
}
