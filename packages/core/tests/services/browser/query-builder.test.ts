import { describe, expect, it } from "vitest";
import { buildBrowserQuery } from "../../../src/services/browser/browser-query-builder";
import type { FilterState, SortConfig } from "../../../src/types/browser.types";
import { EMPTY_FILTER } from "../../../src/types/browser.types";

const DEFAULT_SORT: SortConfig = { column: "due", direction: "asc" };

describe("buildBrowserQuery", () => {
	it("builds base query with no filters", () => {
		const result = buildBrowserQuery(EMPTY_FILTER, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.deleted_at IS NULL");
		expect(result.orderBy).toBe("c.due ASC");
		expect(result.limit).toBe(50);
		expect(result.offset).toBe(0);
		expect(result.params).toEqual([]);
	});

	it("adds state filter for FSRS states", () => {
		const filter: FilterState = { ...EMPTY_FILTER, states: ["new"] };
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.state IN (?)");
		expect(result.params).toContain(0); // State.New = 0
	});

	it("adds suspended filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			states: ["suspended"],
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.suspended = 1");
	});

	it("adds buried filter", () => {
		const filter: FilterState = { ...EMPTY_FILTER, states: ["buried"] };
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.buried_until IS NOT NULL");
	});

	it("combines state and suspended filters with OR", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			states: ["new", "suspended"],
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("OR");
		expect(result.where).toContain("c.suspended = 1");
	});

	it("adds negated state filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			negatedStates: ["suspended"],
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.suspended = 0");
	});

	it("adds text search with LIKE", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			textSearch: "mitosis",
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("n.fields_json LIKE ?");
		expect(result.params).toContain("%mitosis%");
	});

	it("adds source UID filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			sourceUids: ["abc123"],
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.source_uid IN (?)");
		expect(result.params).toContain("abc123");
	});

	it("adds card type filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			cardTypes: ["cloze", "basic"],
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("nt.type");
	});

	it("adds prop filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			propFilters: [{ property: "s", operator: ">", value: 21 }],
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.stability > ?");
		expect(result.params).toContain(21);
	});

	it("adds added days ago filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			addedDaysAgo: 7,
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.created_at >= ?");
		expect(result.params.length).toBe(1);
	});

	it("adds reviewed days ago filter", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			reviewedDaysAgo: 30,
		};
		const result = buildBrowserQuery(filter, DEFAULT_SORT, 50, 0);
		expect(result.where).toContain("c.last_review >= ?");
	});

	it("sanitizes sort column against whitelist", () => {
		const sort: SortConfig = {
			column: "DROP TABLE cards",
			direction: "asc",
		};
		const result = buildBrowserQuery(EMPTY_FILTER, sort, 50, 0);
		// Should fall back to "due" when column not in whitelist
		expect(result.orderBy).toBe("c.due ASC");
	});

	it("respects sort direction", () => {
		const sort: SortConfig = { column: "stability", direction: "desc" };
		const result = buildBrowserQuery(EMPTY_FILTER, sort, 50, 0);
		expect(result.orderBy).toBe("c.stability DESC");
	});

	it("builds complex combined query", () => {
		const filter: FilterState = {
			...EMPTY_FILTER,
			states: ["review"],
			negatedStates: ["suspended"],
			textSearch: "biology",
			propFilters: [{ property: "lapses", operator: ">", value: 3 }],
			cardTypes: ["basic"],
			addedDaysAgo: 30,
		};
		const sort: SortConfig = { column: "lapses", direction: "desc" };
		const result = buildBrowserQuery(filter, sort, 100, 50);

		expect(result.where).toContain("c.state IN (?)");
		expect(result.where).toContain("c.suspended = 0");
		expect(result.where).toContain("n.fields_json LIKE ?");
		expect(result.where).toContain("c.lapses > ?");
		expect(result.where).toContain("nt.type");
		expect(result.where).toContain("c.created_at >= ?");
		expect(result.orderBy).toBe("c.lapses DESC");
		expect(result.limit).toBe(100);
		expect(result.offset).toBe(50);
	});
});
