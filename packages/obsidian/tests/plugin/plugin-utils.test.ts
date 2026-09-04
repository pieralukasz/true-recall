import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	ACCESS_TIER_LABEL,
	resolveAccessTier,
} from "../../src/plugin/plugin-utils";

function settingsWith(patch: Partial<TrueRecallSettings>): TrueRecallSettings {
	return { ...DEFAULT_SETTINGS, ...patch };
}

describe("resolveAccessTier", () => {
	it("is free when no AI key of any kind is configured", () => {
		const settings = settingsWith({
			proKey: undefined,
			openRouterApiKey: "",
			lmStudioModel: "",
			customModel: "",
		});

		expect(resolveAccessTier(settings)).toBe("free");
	});

	it("is byok with an OpenRouter key but no Pro key", () => {
		const settings = settingsWith({
			proKey: undefined,
			providerType: "openrouter",
			openRouterApiKey: "sk-or-test",
		});

		expect(resolveAccessTier(settings)).toBe("byok");
	});

	it("is pro whenever a Pro key is present, regardless of other keys", () => {
		const settings = settingsWith({
			proKey: "pro-key",
			openRouterApiKey: "sk-or-test",
		});

		expect(resolveAccessTier(settings)).toBe("pro");
	});

	it("has a label for every tier", () => {
		expect(ACCESS_TIER_LABEL).toEqual({
			free: "Free",
			byok: "BYOK",
			pro: "True Recall Pro",
		});
	});
});
