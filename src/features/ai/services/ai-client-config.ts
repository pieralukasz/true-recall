import { BYOK_MODELS, DEFAULT_BYOK_MODEL, LITELLM_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { OPENROUTER_URL } from "./openrouter-client";

const PRO_MODEL = "auto";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	isPro: boolean;
	temperature: number;
}

function resolveByokTemperature(settings: TrueRecallSettings): number {
	if (settings.aiTemperature != null) return settings.aiTemperature;
	const model = BYOK_MODELS.find((m) => m.id === settings.aiModel);
	return model?.defaultTemperature ?? 0.7;
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (settings.proKey) {
		return {
			apiKey: settings.proKey,
			model: PRO_MODEL,
			baseUrl: LITELLM_URL,
			isPro: true,
			temperature: 0.7,
		};
	}

	if (settings.openRouterApiKey) {
		return {
			apiKey: settings.openRouterApiKey,
			model: settings.aiModel || DEFAULT_BYOK_MODEL,
			baseUrl: OPENROUTER_URL,
			isPro: false,
			temperature: resolveByokTemperature(settings),
		};
	}

	throw new Error(
		"No AI key configured. Add your Pro key or OpenRouter API key in settings.",
	);
}

export function hasAIKey(settings: TrueRecallSettings): boolean {
	return !!(settings.proKey || settings.openRouterApiKey);
}
