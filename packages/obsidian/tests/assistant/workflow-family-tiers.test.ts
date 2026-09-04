import { describe, expect, it } from "vitest";

import { aiAssistantManifest } from "@true-recall/plugins/ai-assistant";
import { aiGenerationManifest } from "@true-recall/plugins/ai-generation";
import { cardPolishManifest } from "@true-recall/plugins/card-polish";

/** Compatibility manifests keep the same entitlement while their settings and
 * visibility are consolidated under AI Workspace. */
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
