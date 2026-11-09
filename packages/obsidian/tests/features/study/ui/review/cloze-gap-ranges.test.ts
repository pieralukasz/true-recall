import { describe, expect, it } from "vitest";

import { placeholderRanges } from "../../../../../src/features/study/ui/review/helpers/cloze-gap-ranges";

const text = (q: string, ranges: [number, number][]) =>
	ranges.map(([a, b]) => q.slice(a, b));

describe("placeholderRanges", () => {
	it("tints only the gaps of the card, not other brackets", () => {
		const template = "In code a[0] is the {{c1::first}} item, see [^1] and {{c2::x::hint}}";
		const question = "In code a[0] is the [...] item, see [^1] and x";
		expect(text(question, placeholderRanges(question, template, 1))).toEqual([
			"[...]",
		]);
	});

	it("finds a hint placeholder", () => {
		const question = "Capital of France is [city]";
		expect(
			text(question, placeholderRanges(question, "Capital of France is {{c1::Paris::city}}", 1)),
		).toEqual(["[city]"]);
	});

	it("without a template tints only the [...] marker", () => {
		const question = "Use [ ] or [...] here";
		expect(text(question, placeholderRanges(question))).toEqual(["[...]"]);
	});

	it("skips links", () => {
		const question = "[...] and [link](https://x.y) and [[note]]";
		expect(text(question, placeholderRanges(question))).toEqual(["[...]"]);
	});
});
