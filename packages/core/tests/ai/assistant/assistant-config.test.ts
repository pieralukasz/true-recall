import { describe, expect, it } from "vitest";

import { resolveAIClientConfig } from "../../../src/ai/config/ai-client-config";
import { DEFAULT_SETTINGS } from "../../../src/constants";
import type { TrueRecallSettings } from "../../../src/types/settings.types";

function byokSettings(
	patch: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	return {
		...DEFAULT_SETTINGS,
		providerType: "openrouter",
		openRouterApiKey: "sk-or-test",
		aiModel: "google/gemini-2.5-flash",
		...patch,
	};
}

describe("assistant AI config scope", () => {
	it("inherits the default model when assistantModel is empty", () => {
		const config = resolveAIClientConfig(byokSettings(), "assistant");
		expect(config.model).toBe("google/gemini-2.5-flash");
	});

	it("uses assistantModel override when set", () => {
		const config = resolveAIClientConfig(
			byokSettings({ assistantModel: "anthropic/claude-sonnet-4" }),
			"assistant",
		);
		expect(config.model).toBe("anthropic/claude-sonnet-4");
	});

	it("ignores assistantModel for other scopes", () => {
		const config = resolveAIClientConfig(
			byokSettings({ assistantModel: "anthropic/claude-sonnet-4" }),
			"generation",
		);
		expect(config.model).toBe("google/gemini-2.5-flash");
	});

	it("has assistant defaults in DEFAULT_SETTINGS", () => {
		expect(DEFAULT_SETTINGS.assistantModel).toBe("");
		expect(DEFAULT_SETTINGS.assistantWebSearch).toBe(true);
		expect(DEFAULT_SETTINGS.assistantInstructions).toBe("");
		expect(DEFAULT_SETTINGS.assistantMaxIterations).toBe(5);
		expect(DEFAULT_SETTINGS.assistantMaxSources).toBe(5);
		expect(DEFAULT_SETTINGS.assistantPresets.length).toBeGreaterThan(0);
	});
});
