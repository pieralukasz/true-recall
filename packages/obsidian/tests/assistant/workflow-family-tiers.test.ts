import { describe, expect, it } from "vitest";

import { aiAssistantManifest } from "@true-recall/plugins/ai-assistant";
import { aiGenerationManifest } from "@true-recall/plugins/ai-generation";
import { cardPolishManifest } from "@true-recall/plugins/card-polish";

/** `isWorkflowFamilyEnabled` collapses the tier rule to "a key is configured"
 * because all three AI families ship at byok tier. If one ever moves to pro,
 * that shortcut becomes wrong — this is the tripwire. */
describe("AI preset family tiers", () => {
	it.each([
		["ai-assistant", aiAssistantManifest],
		["ai-generation", aiGenerationManifest],
		["card-polish", cardPolishManifest],
	])("%s stays byok-tier", (id, manifest) => {
		expect(manifest.info.id).toBe(id);
		expect(manifest.info.tier).toBe("byok");
	});
});
