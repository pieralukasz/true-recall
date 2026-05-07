import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";

import { isPluginActive } from "../../src/settings/tabs/plugin-availability";
import type { PluginManifest } from "@true-recall/plugins";

const aiGenerationManifest = {
	info: { id: "ai-generation", tier: "byok" },
} as PluginManifest;

describe("isPluginActive", () => {
	it("activates AI Generation when only the scoped LM Studio generation model is set", () => {
		expect(
			isPluginActive(aiGenerationManifest, {
				...DEFAULT_SETTINGS,
				providerType: "lmstudio",
				lmStudioModel: "",
				lmStudioGenerationModel: "generation-model",
			}),
		).toBe(true);
	});

	it("does not activate unrelated byok behavior through scoped generation config alone", () => {
		expect(
			isPluginActive(
				{ info: { id: "other-byok", tier: "byok" } } as PluginManifest,
				{
					...DEFAULT_SETTINGS,
					providerType: "lmstudio",
					lmStudioModel: "",
					lmStudioGenerationModel: "generation-model",
				},
			),
		).toBe(false);
	});
});
