import { describe, expect, it } from "vitest";
import { withSectionLabels } from "../../../src/shared/ui/components/search-combobox.utils";
import type { SearchSuggestion } from "../../../src/shared/ui/helpers/search-suggestions.types";

describe("withSectionLabels", () => {
	it("adds section labels on first suggestion of each category", () => {
		const input: SearchSuggestion[] = [
			{
				id: "1",
				label: "is:new",
				insertText: "is:new",
				category: "state",
			},
			{
				id: "x",
				label: "prop:ivl>",
				insertText: "prop:ivl>",
				category: "property",
			},
			{
				id: "2",
				label: "is:review",
				insertText: "is:review",
				category: "state",
			},
			{
				id: "3",
				label: "prop:lapses>",
				insertText: "prop:lapses>",
				category: "property",
			},
		];

		const output = withSectionLabels(input);

		expect(output[0]?.showSectionLabel).toBe(true);
		expect(output[0]?.sectionLabel).toBe("States");
		expect(output[1]?.showSectionLabel).toBe(false);
		expect(output[2]?.showSectionLabel).toBe(true);
		expect(output[2]?.sectionLabel).toBe("Properties");
		expect(output[3]?.showSectionLabel).toBe(false);
	});
});
