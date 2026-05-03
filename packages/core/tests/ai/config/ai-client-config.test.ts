import { describe, expect, it } from "vitest";

import {
	hasAIKey,
	resolveAIClientConfig,
} from "../../../src/ai/config/ai-client-config";
import { DEFAULT_SETTINGS } from "../../../src/constants";
import type { TrueRecallSettings } from "../../../src/types/settings.types";

function s(overrides: Partial<TrueRecallSettings> = {}): TrueRecallSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

describe("lmstudio scoped overrides", () => {
	it("uses generation override for generation scope", () => {
		const config = resolveAIClientConfig(
			s({
				providerType: "lmstudio",
				lmStudioModel: "global-model",
				lmStudioGenerationModel: "generation-model",
				lmStudioCardPolishModel: "polish-model",
			}),
			"generation",
		);

		expect(config.model).toBe("generation-model");
	});

	it("uses card polish override for card-polish scope", () => {
		const config = resolveAIClientConfig(
			s({
				providerType: "lmstudio",
				lmStudioModel: "global-model",
				lmStudioGenerationModel: "generation-model",
				lmStudioCardPolishModel: "polish-model",
			}),
			"card-polish",
		);

		expect(config.model).toBe("polish-model");
	});

	it("falls back to global lmStudioModel when scoped override is empty", () => {
		const config = resolveAIClientConfig(
			s({
				providerType: "lmstudio",
				lmStudioModel: "global-model",
				lmStudioGenerationModel: "",
			}),
			"generation",
		);

		expect(config.model).toBe("global-model");
	});
});

describe("hasAIKey scoped overrides", () => {
	it("returns true for generation scope when only generation override is set", () => {
		expect(
			hasAIKey(
				s({
					providerType: "lmstudio",
					lmStudioModel: "",
					lmStudioGenerationModel: "generation-model",
				}),
				"generation",
			),
		).toBe(true);
	});

	it("returns true for card-polish scope when only card polish override is set", () => {
		expect(
			hasAIKey(
				s({
					providerType: "lmstudio",
					lmStudioModel: "",
					lmStudioCardPolishModel: "polish-model",
				}),
				"card-polish",
			),
		).toBe(true);
	});

	it("keeps default scope on the global lmStudioModel only", () => {
		expect(
			hasAIKey(
				s({
					providerType: "lmstudio",
					lmStudioModel: "",
					lmStudioGenerationModel: "generation-model",
				}),
			),
		).toBe(false);
	});
});

describe("resolveAIClientConfig", () => {
	describe("pro provider", () => {
		it("returns pro config when proKey is set", () => {
			const config = resolveAIClientConfig(
				s({ providerType: "pro", proKey: "pk_test" }),
			);
			expect(config.hasProTier).toBe(true);
			expect(config.providerType).toBe("pro");
			expect(config.model).toBe("auto");
			expect(config.baseUrl).toBe(
				"https://ai.truerecall.app/v1/chat/completions",
			);
			expect(config.temperature).toBe(0.7);
		});

		it("throws when proKey is not set", () => {
			expect(() => resolveAIClientConfig(s({ providerType: "pro" }))).toThrow(
				"Pro key is not configured",
			);
		});
	});

	describe("openrouter provider", () => {
		it("returns openrouter config with BYOK model", () => {
			const config = resolveAIClientConfig(
				s({
					providerType: "openrouter",
					openRouterApiKey: "sk_or_test",
					aiModel: "google/gemini-2.5-flash",
				}),
			);
			expect(config.hasProTier).toBe(false);
			expect(config.providerType).toBe("openrouter");
			expect(config.model).toBe("google/gemini-2.5-flash");
			expect(config.baseUrl).toBe(
				"https://openrouter.ai/api/v1/chat/completions",
			);
		});

		it("uses custom model ID when set", () => {
			const config = resolveAIClientConfig(
				s({
					providerType: "openrouter",
					openRouterApiKey: "sk_or_test",
					aiModel: "__custom__",
					customAiModel: "openai/gpt-4o-mini",
				}),
			);
			expect(config.model).toBe("openai/gpt-4o-mini");
		});

		it("throws when openRouterApiKey is not set", () => {
			expect(() =>
				resolveAIClientConfig(s({ providerType: "openrouter" })),
			).toThrow("OpenRouter API key is not configured");
		});
	});

	describe("custom provider", () => {
		it("returns custom config with Ollama defaults", () => {
			const config = resolveAIClientConfig(
				s({ providerType: "custom", customModel: "llama3" }),
			);
			expect(config.hasProTier).toBe(false);
			expect(config.providerType).toBe("custom");
			expect(config.model).toBe("llama3");
			expect(config.baseUrl).toBe("http://localhost:11434/v1");
			expect(config.apiKey).toBe("ollama");
			expect(config.temperature).toBe(0.7);
		});

		it("uses custom baseUrl when set", () => {
			const config = resolveAIClientConfig(
				s({
					providerType: "custom",
					customBaseUrl: "http://192.168.1.100:8080/v1",
					customModel: "mistral",
				}),
			);
			expect(config.baseUrl).toBe("http://192.168.1.100:8080/v1");
		});

		it("uses customApiKey when set", () => {
			const config = resolveAIClientConfig(
				s({
					providerType: "custom",
					customApiKey: "sk_local",
					customModel: "gemma2",
				}),
			);
			expect(config.apiKey).toBe("sk_local");
		});

		it("uses customTemperature when set", () => {
			const config = resolveAIClientConfig(
				s({
					providerType: "custom",
					customModel: "llama3",
					customTemperature: 0.3,
				}),
			);
			expect(config.temperature).toBe(0.3);
		});

		it("throws when customModel is not set", () => {
			expect(() =>
				resolveAIClientConfig(s({ providerType: "custom", customModel: "" })),
			).toThrow("Custom model name is not configured");
		});
	});
});

describe("hasAIKey", () => {
	it("returns true for pro provider with key", () => {
		expect(hasAIKey(s({ providerType: "pro", proKey: "pk_test" }))).toBe(true);
	});

	it("returns false for pro provider without key", () => {
		expect(hasAIKey(s({ providerType: "pro", proKey: undefined }))).toBe(false);
	});

	it("returns true for openrouter provider with key", () => {
		expect(
			hasAIKey(s({ providerType: "openrouter", openRouterApiKey: "sk_test" })),
		).toBe(true);
	});

	it("returns false for openrouter provider without key", () => {
		expect(
			hasAIKey(s({ providerType: "openrouter", openRouterApiKey: "" })),
		).toBe(false);
	});

	it("returns true for custom provider with model", () => {
		expect(hasAIKey(s({ providerType: "custom", customModel: "llama3" }))).toBe(
			true,
		);
	});

	it("returns false for custom provider without model", () => {
		expect(hasAIKey(s({ providerType: "custom", customModel: "" }))).toBe(
			false,
		);
	});
});
