import { describe, it, expect } from "vitest";
import { parseSearchQuery } from "../../../src/features/library/ui/browser/helpers/search-parser";

describe("parseSearchQuery", () => {
	it("returns empty filter for empty input", () => {
		const result = parseSearchQuery("");
		expect(result.textSearch).toBe("");
		expect(result.states).toEqual([]);
	});

	it("parses plain text search", () => {
		const result = parseSearchQuery("mitosis cell");
		expect(result.textSearch).toBe("mitosis cell");
		expect(result.states).toEqual([]);
	});

	it("parses is: state filters", () => {
		const result = parseSearchQuery("is:new");
		expect(result.states).toEqual(["new"]);
		expect(result.textSearch).toBe("");
	});

	it("parses multiple is: filters", () => {
		const result = parseSearchQuery("is:new is:learning");
		expect(result.states).toEqual(["new", "learning"]);
	});

	it("parses all valid states", () => {
		const states = [
			"new",
			"learning",
			"review",
			"relearning",
			"suspended",
			"buried",
		];
		for (const state of states) {
			const result = parseSearchQuery(`is:${state}`);
			expect(result.states.length).toBeGreaterThanOrEqual(1);
		}
	});

	it("parses negated states", () => {
		const result = parseSearchQuery("-is:suspended");
		expect(result.negatedStates).toEqual(["suspended"]);
		expect(result.states).toEqual([]);
	});

	it("parses prop filters", () => {
		const result = parseSearchQuery("prop:s>21");
		expect(result.propFilters).toEqual([
			{ property: "s", operator: ">", value: 21 },
		]);
	});

	it("parses prop filters with >=", () => {
		const result = parseSearchQuery("prop:lapses>=3");
		expect(result.propFilters).toEqual([
			{ property: "lapses", operator: ">=", value: 3 },
		]);
	});

	it("parses prop filters with decimal values", () => {
		const result = parseSearchQuery("prop:d>0.5");
		expect(result.propFilters).toEqual([
			{ property: "d", operator: ">", value: 0.5 },
		]);
	});

	it("parses note: filter", () => {
		const result = parseSearchQuery('note:"Biology"');
		expect(result.sourceUids).toEqual(["Biology"]);
	});

	it("parses type: filter", () => {
		const result = parseSearchQuery("type:cloze");
		expect(result.cardTypes).toEqual(["cloze"]);
	});

	it("parses via: filter", () => {
		const result = parseSearchQuery("via:ai");
		expect(result.createdVia).toEqual(["ai"]);
	});

	it("parses added: date filter", () => {
		const result = parseSearchQuery("added:7");
		expect(result.addedDaysAgo).toBe(7);
	});

	it("parses reviewed: date filter", () => {
		const result = parseSearchQuery("reviewed:30");
		expect(result.reviewedDaysAgo).toBe(30);
	});

	it("parses mixed filters and text", () => {
		const result = parseSearchQuery("is:new mitosis prop:s<7");
		expect(result.states).toEqual(["new"]);
		expect(result.textSearch).toBe("mitosis");
		expect(result.propFilters).toEqual([
			{ property: "s", operator: "<", value: 7 },
		]);
	});

	it("handles quoted strings in text", () => {
		const result = parseSearchQuery('"cell division"');
		expect(result.textSearch).toBe("cell division");
	});

	it("ignores invalid state values", () => {
		const result = parseSearchQuery("is:invalid");
		expect(result.states).toEqual([]);
	});

	it("ignores invalid prop filters", () => {
		const result = parseSearchQuery("prop:invalid>5");
		expect(result.propFilters).toEqual([]);
	});

	it("parses preset: filter", () => {
		const result = parseSearchQuery('preset:"Hard Mode"');
		expect(result.presetNames).toEqual(["Hard Mode"]);
	});

	it("handles complex queries", () => {
		const result = parseSearchQuery(
			'is:review -is:suspended prop:lapses>3 note:"Anatomy" type:basic added:30 mitosis',
		);
		expect(result.states).toEqual(["review"]);
		expect(result.negatedStates).toEqual(["suspended"]);
		expect(result.propFilters).toEqual([
			{ property: "lapses", operator: ">", value: 3 },
		]);
		expect(result.sourceUids).toEqual(["Anatomy"]);
		expect(result.cardTypes).toEqual(["basic"]);
		expect(result.addedDaysAgo).toBe(30);
		expect(result.textSearch).toBe("mitosis");
	});
});
