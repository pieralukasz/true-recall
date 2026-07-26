import { describe, expect, it } from "vitest";

import {
	type AiSurfaceIntent,
	entryForSurface,
	resolveAiSurface,
} from "../../src/features/assistant/ui/ai-surface";

const desktop = { hasAnchor: true, isMobile: false };

describe("resolveAiSurface", () => {
	it.each<[AiSurfaceIntent, "popover" | "docked"]>([
		["preset", "popover"],
		["selection", "popover"],
		["compose", "docked"],
	])("routes %s to %s when anchored on desktop", (intent, expected) => {
		expect(resolveAiSurface({ intent, ...desktop })).toBe(expected);
	});

	it("falls back to the docked panel when a fast path has no anchor", () => {
		expect(
			resolveAiSurface({ intent: "preset", hasAnchor: false, isMobile: false }),
		).toBe("docked");
	});

	it.each<AiSurfaceIntent>([
		"preset",
		"selection",
		"compose",
	])("collapses %s to a modal on mobile", (intent) => {
		expect(resolveAiSurface({ intent, hasAnchor: true, isMobile: true })).toBe(
			"modal",
		);
	});

	it("honors an explicit preference on desktop", () => {
		expect(
			resolveAiSurface({ intent: "compose", ...desktop, prefer: "popout" }),
		).toBe("popout");
	});

	it("ignores an explicit preference on mobile", () => {
		expect(
			resolveAiSurface({
				intent: "compose",
				hasAnchor: false,
				isMobile: true,
				prefer: "popout",
			}),
		).toBe("modal");
	});
});

describe("entryForSurface", () => {
	it("opens on the preset list for preset intents regardless of surface", () => {
		expect(entryForSurface("docked", "preset")).toBe("presets");
		expect(entryForSurface("modal", "preset")).toBe("presets");
	});

	it("opens popovers on the preset list", () => {
		expect(entryForSurface("popover", "selection")).toBe("presets");
	});

	it("opens roomy surfaces on the composer", () => {
		expect(entryForSurface("docked", "compose")).toBe("compose");
		expect(entryForSurface("popout", "compose")).toBe("compose");
	});
});
