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
	});

	it("uses AI Workspace as the single preference for every family", () => {
		const disabled = withStates({ "ai-assistant": false });
		expect(isWorkflowFamilyEnabled(disabled, "agent")).toBe(false);
		expect(isWorkflowFamilyEnabled(disabled, "generate-cards")).toBe(false);
		expect(isWorkflowFamilyEnabled(disabled, "modify-card")).toBe(false);
	});

	it("ignores legacy family-specific preferences", () => {
		const settings = withStates({
			"ai-generation": false,
			"card-polish": false,
		});
		expect(isWorkflowFamilyEnabled(settings, "generate-cards")).toBe(true);
		expect(isWorkflowFamilyEnabled(settings, "modify-card")).toBe(true);
	});

	it("disables every family when no key is configured", () => {
		const noKey = { ...DEFAULT_SETTINGS, pluginStates: {} };
		expect(isWorkflowFamilyEnabled(noKey, "agent")).toBe(false);
		expect(isWorkflowFamilyEnabled(noKey, "modify-card")).toBe(false);
	});
});
