import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import type { TrueRecallSettings } from "@true-recall/core/types";

import { isWorkflowFamilyEnabled } from "../../src/features/assistant/ui/workflow-family-gate";

const withStates = (
	pluginStates: Record<string, boolean> = {},
): TrueRecallSettings =>
	({
		...DEFAULT_SETTINGS,
		providerType: "openrouter",
		openRouterApiKey: "sk-test",
		pluginStates,
	}) as TrueRecallSettings;

describe("isWorkflowFamilyEnabled", () => {
	it("treats a family with no stored state as enabled", () => {
		const settings = withStates();
		expect(isWorkflowFamilyEnabled(settings, "agent")).toBe(true);
		expect(isWorkflowFamilyEnabled(settings, "generate-cards")).toBe(true);
		expect(isWorkflowFamilyEnabled(settings, "modify-card")).toBe(true);
		expect(isWorkflowFamilyEnabled(settings, "fact-check")).toBe(true);
	});

	it("maps each family to the feature that owns it", () => {
		expect(
			isWorkflowFamilyEnabled(
				withStates({ "card-polish": false }),
				"modify-card",
			),
		).toBe(false);
		expect(
			isWorkflowFamilyEnabled(withStates({ "card-polish": false }), "agent"),
		).toBe(true);
		expect(
			isWorkflowFamilyEnabled(
				withStates({ "ai-assistant": false }),
				"fact-check",
			),
		).toBe(false);
		expect(
			isWorkflowFamilyEnabled(
				withStates({ "card-polish": false }),
				"fact-check",
			),
		).toBe(true);
		expect(
			isWorkflowFamilyEnabled(
				withStates({ "ai-generation": false }),
				"generate-cards",
			),
		).toBe(false);
		expect(
			isWorkflowFamilyEnabled(withStates({ "ai-assistant": false }), "agent"),
		).toBe(false);
	});

	it("disables every family when no key is configured", () => {
		const noKey = { ...DEFAULT_SETTINGS, pluginStates: {} };
		expect(isWorkflowFamilyEnabled(noKey, "agent")).toBe(false);
		expect(isWorkflowFamilyEnabled(noKey, "modify-card")).toBe(false);
	});
});
