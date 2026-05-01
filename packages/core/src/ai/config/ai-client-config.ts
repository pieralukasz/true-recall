import {
	BYOK_MODELS,
	CUSTOM_MODEL_ID,
	DEFAULT_BYOK_MODEL,
	DEFAULT_CUSTOM_BASE_URL,
	DEFAULT_LMSTUDIO_BASE_URL,
	LITELLM_URL,
} from "../../constants";
import type { TrueRecallSettings } from "../../types/settings.types";
import { OPENROUTER_URL } from "../clients/openrouter-client";

const PRO_MODEL = "auto";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	hasProTier: boolean;
	temperature: number;
	providerType: "pro" | "openrouter" | "custom" | "lmstudio";
}

function resolveByokTemperature(settings: TrueRecallSettings): number {
	if (settings.aiTemperature != null) return settings.aiTemperature;
	const model = BYOK_MODELS.find((m) => m.id === settings.aiModel);
	return model?.defaultTemperature ?? 0.7;
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	switch (settings.providerType) {
		case "pro": {
			if (!settings.proKey) {
				throw new Error("Pro key is not configured.");
			}
			return {
				apiKey: settings.proKey,
				model: PRO_MODEL,
				baseUrl: LITELLM_URL,
				hasProTier: true,
				temperature: 0.7,
				providerType: "pro",
			};
		}

		case "lmstudio": {
			if (!settings.lmStudioModel) {
				throw new Error("LM Studio model is not configured.");
			}
			const lmBaseUrl = settings.lmStudioBaseUrl || DEFAULT_LMSTUDIO_BASE_URL;
			return {
				apiKey: settings.lmStudioApiKey || "lm-studio",
				model: settings.lmStudioModel,
				baseUrl: lmBaseUrl.endsWith("/chat/completions")
					? lmBaseUrl
					: `${lmBaseUrl.replace(/\/$/, "")}/chat/completions`,
				hasProTier: false,
				temperature: settings.lmStudioTemperature ?? 0.7,
				providerType: "lmstudio",
			};
		}

		case "custom": {
			if (!settings.customModel) {
				throw new Error("Custom model name is not configured.");
			}
			return {
				apiKey: settings.customApiKey || "ollama",
				model: settings.customModel,
				baseUrl: settings.customBaseUrl || DEFAULT_CUSTOM_BASE_URL,
				hasProTier: false,
				temperature: settings.customTemperature ?? 0.7,
				providerType: "custom",
			};
		}

		// biome-ignore lint/complexity/noUselessSwitchCase: openrouter is the documented default
		case "openrouter":
		default: {
			if (!settings.openRouterApiKey) {
				throw new Error("OpenRouter API key is not configured.");
			}
			const model =
				settings.aiModel === CUSTOM_MODEL_ID
					? settings.customAiModel || DEFAULT_BYOK_MODEL
					: settings.aiModel || DEFAULT_BYOK_MODEL;
			return {
				apiKey: settings.openRouterApiKey,
				model,
				baseUrl: OPENROUTER_URL,
				hasProTier: false,
				temperature: resolveByokTemperature(settings),
				providerType: "openrouter",
			};
		}
	}
}

export function hasAIKey(settings: TrueRecallSettings): boolean {
	switch (settings.providerType) {
		case "pro":
			return !!settings.proKey?.trim();
		case "lmstudio":
			return !!settings.lmStudioModel?.trim();
		case "custom":
			return !!settings.customModel?.trim();
		// biome-ignore lint/complexity/noUselessSwitchCase: openrouter is the documented default
		case "openrouter":
		default:
			return !!(
				settings.proKey?.trim() ||
				settings.openRouterApiKey?.trim() ||
				settings.lmStudioModel?.trim() ||
				settings.customModel?.trim()
			);
	}
}
