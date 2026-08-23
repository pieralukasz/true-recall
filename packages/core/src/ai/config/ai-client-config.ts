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

export type AIConfigScope =
	| "default"
	| "generation"
	| "card-polish"
	| "assistant"
	| "grading";

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

function resolveLmStudioModel(
	settings: TrueRecallSettings,
	scope: AIConfigScope,
): string {
	if (scope === "generation") {
		return (
			settings.lmStudioGenerationModel.trim() || settings.lmStudioModel.trim()
		);
	}

	if (scope === "card-polish") {
		return (
			settings.lmStudioCardPolishModel.trim() || settings.lmStudioModel.trim()
		);
	}

	if (scope === "grading") {
		return (
			settings.lmStudioGradingModel.trim() || settings.lmStudioModel.trim()
		);
	}

	return settings.lmStudioModel.trim();
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
	scope: AIConfigScope = "default",
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
			const lmStudioModel = resolveLmStudioModel(settings, scope);
			if (!lmStudioModel) {
				throw new Error("LM Studio model is not configured.");
			}

			const lmBaseUrl = settings.lmStudioBaseUrl || DEFAULT_LMSTUDIO_BASE_URL;
			return {
				apiKey: settings.lmStudioApiKey || "lm-studio",
				model: lmStudioModel,
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
			const defaultModel =
				settings.aiModel === CUSTOM_MODEL_ID
					? settings.customAiModel || DEFAULT_BYOK_MODEL
					: settings.aiModel || DEFAULT_BYOK_MODEL;
			const model =
				scope === "assistant" && settings.assistantModel.trim() !== ""
					? settings.assistantModel.trim()
					: scope === "grading" && settings.gradingModel.trim() !== ""
						? settings.gradingModel.trim()
						: defaultModel;
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

export function hasAIKey(
	settings: TrueRecallSettings,
	scope: AIConfigScope = "default",
): boolean {
	switch (settings.providerType) {
		case "lmstudio":
			return resolveLmStudioModel(settings, scope).length > 0;
		case "pro":
			return !!settings.proKey?.trim();
		case "custom":
			return !!settings.customModel?.trim();
		// biome-ignore lint/complexity/noUselessSwitchCase: openrouter is the documented default
		case "openrouter":
		default:
			return !!(
				settings.proKey?.trim() ||
				settings.openRouterApiKey?.trim() ||
				resolveLmStudioModel(settings, scope).trim().length > 0 ||
				settings.customModel?.trim()
			);
	}
}
