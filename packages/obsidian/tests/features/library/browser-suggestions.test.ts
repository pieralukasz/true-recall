import { describe, expect, it } from "vitest";

import { createBrowserSuggestionProvider } from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-suggestions";

const provider = createBrowserSuggestionProvider({
	sourceNotes: [],
	presetNames: [],
	projectNames: [],
	tags: [
		{ name: "biology", count: 4 },
		{ name: "leech", count: 2 },
		{ name: "med::cardio", count: 1 },
	],
});

describe("createBrowserSuggestionProvider: tag:", () => {
	it("suggests note tags with card counts", () => {
		const suggestions = provider("tag:le", 6);
		expect(suggestions.map((s) => s.insertText)).toEqual(["tag:leech"]);
		expect(suggestions[0]?.description).toBe("2 cards");
	});

	it("lists every tag for an empty value", () => {
		expect(provider("tag:", 4).map((s) => s.label)).toEqual([
			"tag:biology",
			"tag:leech",
			"tag:med::cardio",
		]);
	});

	it("keeps the negation", () => {
		expect(provider("-tag:bio", 8).map((s) => s.insertText)).toEqual([
			"-tag:biology",
		]);
	});
});
