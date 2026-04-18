import { describe, expect, it } from "vitest";

import {
	DEFAULT_CARD_POLISH_PRESETS,
	DEFAULT_CARD_POLISH_SETTINGS,
} from "@true-recall/plugins/card-polish/default-presets";

describe("default card-polish presets", () => {
	it("ships exactly three builtin presets", () => {
		expect(DEFAULT_CARD_POLISH_PRESETS).toHaveLength(3);
		for (const p of DEFAULT_CARD_POLISH_PRESETS) {
			expect(p.builtin).toBe(true);
			expect(p.id.length).toBeGreaterThan(0);
			expect(p.prompt.length).toBeGreaterThan(10);
		}
	});

	it("only Fix formatting is auto-apply", () => {
		const map = Object.fromEntries(
			DEFAULT_CARD_POLISH_PRESETS.map((p) => [p.name, p.autoApply]),
		);
		expect(map["Fix formatting"]).toBe(true);
		expect(map.Simplify).toBe(false);
		expect(map.Shorten).toBe(false);
	});

	it("DEFAULT_CARD_POLISH_SETTINGS is safe by default", () => {
		expect(DEFAULT_CARD_POLISH_SETTINGS.customPromptAutoApply).toBe(false);
		expect(DEFAULT_CARD_POLISH_SETTINGS.presets).toHaveLength(3);
	});
});
