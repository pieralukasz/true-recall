import { describe, expect, it } from "vitest";

import { SETTINGS_PAGES } from "../../src/settings/settings-pages";

describe("settings pages", () => {
	it("keeps native page names and identifiers unique", () => {
		expect(new Set(SETTINGS_PAGES.map((page) => page.id)).size).toBe(
			SETTINGS_PAGES.length,
		);
		expect(new Set(SETTINGS_PAGES.map((page) => page.name)).size).toBe(
			SETTINGS_PAGES.length,
		);
	});

	it("provides search terms for every page", () => {
		for (const page of SETTINGS_PAGES) {
			expect(page.description.length).toBeGreaterThan(0);
			expect(page.searchAliases.length).toBeGreaterThan(0);
			expect(new Set(page.searchAliases).size).toBe(page.searchAliases.length);
		}
	});
});
