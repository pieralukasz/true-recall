import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	factCheckDisplayMessage,
	isFactCheckAvailable,
} from "../../src/features/assistant/ui/fact-check";

const settingsWith = (
	overrides: Partial<TrueRecallSettings>,
): TrueRecallSettings =>
	({
		...DEFAULT_SETTINGS,
		pluginStates: {},
		...overrides,
	}) as TrueRecallSettings;

describe("isFactCheckAvailable", () => {
	it("is available on OpenRouter with a key", () => {
		expect(
			isFactCheckAvailable(
				settingsWith({ providerType: "openrouter", openRouterApiKey: "sk" }),
			),
		).toBe(true);
	});

	it("is available on the Pro provider", () => {
		expect(
			isFactCheckAvailable(
				settingsWith({ providerType: "pro", proKey: "pro-1" }),
			),
		).toBe(true);
	});

	it("is unavailable on providers without web search", () => {
		expect(
			isFactCheckAvailable(
				settingsWith({ providerType: "lmstudio", lmStudioModel: "qwen" }),
			),
		).toBe(false);
		expect(
			isFactCheckAvailable(
				settingsWith({ providerType: "custom", customModel: "llama" }),
			),
		).toBe(false);
	});

	it("is unavailable without any key or when AI Workspace is switched off", () => {
		expect(
			isFactCheckAvailable(settingsWith({ providerType: "openrouter" })),
		).toBe(false);
		expect(
			isFactCheckAvailable(
				settingsWith({
					providerType: "openrouter",
					openRouterApiKey: "sk",
					pluginStates: { "ai-assistant": false },
				}),
			),
		).toBe(false);
	});
});

describe("factCheckDisplayMessage", () => {
	it("strips card markup and truncates long questions", () => {
		expect(factCheckDisplayMessage("What is the **[[spacing effect]]**?")).toBe(
			"Fact check: What is the spacing effect?",
		);
		const long = "a".repeat(80);
		expect(factCheckDisplayMessage(long)).toBe(
			`Fact check: ${"a".repeat(57)}...`,
		);
	});

	it("labels an empty question", () => {
		expect(factCheckDisplayMessage("   ")).toBe("Fact check: (empty question)");
	});
});
