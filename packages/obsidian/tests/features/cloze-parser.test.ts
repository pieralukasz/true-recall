import { describe, expect, it } from "vitest";

import {
	hasClozeSyntax,
	parseClozeText,
} from "../../src/features/library/ui/panel/utils/cloze-parser";

describe("hasClozeSyntax", () => {
	it("returns true consistently across repeated calls on the same input", () => {
		const text = "The capital of France is {{c1::Paris}}.";
		// Regression: a /g regex with .test() alternated true/false here.
		expect(hasClozeSyntax(text)).toBe(true);
		expect(hasClozeSyntax(text)).toBe(true);
		expect(hasClozeSyntax(text)).toBe(true);
	});

	it("returns false for plain text and null", () => {
		expect(hasClozeSyntax("no cloze here")).toBe(false);
		expect(hasClozeSyntax(null)).toBe(false);
	});
});

describe("parseClozeText", () => {
	it("splits text into plain and cloze parts", () => {
		const parts = parseClozeText("A {{c1::B}} C");
		expect(parts).toEqual([
			{ text: "A ", isCloze: false, clozeIndex: null, isIncomplete: false },
			{ text: "B", isCloze: true, clozeIndex: 1, isIncomplete: false },
			{ text: " C", isCloze: false, clozeIndex: null, isIncomplete: false },
		]);
	});

	it("marks an unterminated cloze as incomplete (streaming render)", () => {
		const parts = parseClozeText("A {{c2::partial answ");
		expect(parts[1]).toEqual({
			text: "partial answ",
			isCloze: true,
			clozeIndex: 2,
			isIncomplete: true,
		});
	});
});
