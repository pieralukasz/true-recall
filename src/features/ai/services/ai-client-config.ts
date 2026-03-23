import type { TrueRecallSettings } from "@shared/types/settings.types";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export interface AIClientConfig {
	apiKey: string;
	model: string;
	proxyUrl: string | undefined;
}

export function resolveAIClientConfig(
	settings: TrueRecallSettings,
): AIClientConfig {
	if (!settings.openRouterApiKey) {
		throw new Error(
			"No AI key configured. Add your OpenRouter API key in settings.",
		);
	}

	return {
		apiKey: settings.openRouterApiKey,
		model: DEFAULT_MODEL,
		proxyUrl: undefined,
	};
}
