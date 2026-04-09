import { describe, expect, it } from "vitest";

import {
	clearSearchValue,
	getSearchValueAfterEscape,
} from "../../src/components/search-input.utils";

describe("search-input utils", () => {
	it("clears value when Escape is pressed and input is non-empty", () => {
		expect(getSearchValueAfterEscape("Escape", "abc")).toBe("");
	});

	it("does not clear for non-escape keys or empty value", () => {
		expect(getSearchValueAfterEscape("Enter", "abc")).toBeNull();
		expect(getSearchValueAfterEscape("Escape", "")).toBeNull();
	});

	it("clear action always returns empty value", () => {
		expect(clearSearchValue()).toBe("");
	});
});
