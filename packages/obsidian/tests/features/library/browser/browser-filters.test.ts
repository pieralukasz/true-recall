import { describe, expect, it } from "vitest";

import { EMPTY_FILTER } from "@true-recall/core/types/browser.types";

import {
	combineBrowserFilters,
	nextSortConfig,
	toggleListValue,
} from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-filters";
import { getBrowserQueryResetKey } from "@true-recall/obsidian/features/library/ui/browser/helpers/infinite-scroll";

describe("combineBrowserFilters", () => {
	it("returns an empty filter for empty inputs", () => {
		const filter = combineBrowserFilters({
			searchText: "",
			stateFilters: [],
			sidebarFilter: EMPTY_FILTER,
			showArchived: false,
		});

		expect(filter.states).toEqual([]);
		expect(filter.sourceUids).toEqual([]);
		expect(filter.textSearch).toBe("");
		expect(filter.showArchived).toBe(false);
		expect(filter.orphanedOnly).toBeFalsy();
	});

	it("keeps search, toolbar chips and sidebar facets side by side", () => {
		const filter = combineBrowserFilters({
			searchText: "is:new note:Biology type:cloze kidney",
			stateFilters: ["learning"],
			sidebarFilter: {
				...EMPTY_FILTER,
				states: ["suspended"],
				sourceUids: ["uid-1"],
				cardTypes: ["basic"],
				createdVia: ["ai"],
				negatedStates: ["buried"],
			},
			showArchived: true,
		});

		expect(filter.states).toEqual(["new", "learning", "suspended"]);
		expect(filter.sourceUids).toEqual(["Biology", "uid-1"]);
		expect(filter.cardTypes).toEqual(["cloze", "basic"]);
		expect(filter.createdVia).toEqual(["ai"]);
		expect(filter.negatedStates).toEqual(["buried"]);
		expect(filter.textSearch).toBe("kidney");
		expect(filter.showArchived).toBe(true);
	});

	it.each([
		[true, true],
		[false, false],
	])("takes orphanedOnly=%s from the sidebar", (sidebar, expected) => {
		const filter = combineBrowserFilters({
			searchText: "kidney",
			stateFilters: [],
			sidebarFilter: { ...EMPTY_FILTER, orphanedOnly: sidebar },
			showArchived: false,
		});
		expect(Boolean(filter.orphanedOnly)).toBe(expected);
	});

	it("carries flag facets from the sidebar and the search box", () => {
		const filter = combineBrowserFilters({
			searchText: "flag:red",
			stateFilters: [],
			sidebarFilter: { ...EMPTY_FILTER, flags: [3] },
			showArchived: false,
		});

		expect(filter.flags).toEqual([1, 3]);
	});

	it("does not mutate the sidebar filter or the shared empty filter", () => {
		const sidebarFilter = { ...EMPTY_FILTER, states: ["new" as const] };
		combineBrowserFilters({
			searchText: "is:review",
			stateFilters: ["learning"],
			sidebarFilter,
			showArchived: false,
		});

		expect(sidebarFilter.states).toEqual(["new"]);
		expect(EMPTY_FILTER.states).toEqual([]);
	});
});

describe("nextSortConfig", () => {
	it("starts a new column ascending", () => {
		expect(
			nextSortConfig({ column: "due", direction: "desc" }, "lapses"),
		).toEqual({ column: "lapses", direction: "asc" });
	});

	it.each([
		["asc", "desc"],
		["desc", "asc"],
	] as const)("flips %s to %s on the active column", (from, to) => {
		expect(nextSortConfig({ column: "due", direction: from }, "due")).toEqual({
			column: "due",
			direction: to,
		});
	});
});

describe("toggleListValue", () => {
	it("adds a missing value and removes a present one", () => {
		expect(toggleListValue(["a"], "b")).toEqual(["a", "b"]);
		expect(toggleListValue(["a", "b"], "a")).toEqual(["b"]);
	});
});

describe("query reset key", () => {
	const base = {
		searchText: "",
		stateFilters: [],
		sidebarFilter: EMPTY_FILTER,
		showArchived: false,
	};
	const sort = { column: "due", direction: "asc" } as const;

	it("is stable for equal inputs", () => {
		expect(getBrowserQueryResetKey(combineBrowserFilters(base), sort)).toBe(
			getBrowserQueryResetKey(combineBrowserFilters({ ...base }), sort),
		);
	});

	it.each([
		["search text", { ...base, searchText: "kidney" }, sort],
		["state chips", { ...base, stateFilters: ["new" as const] }, sort],
		[
			"sidebar",
			{ ...base, sidebarFilter: { ...EMPTY_FILTER, sourceUids: ["u"] } },
			sort,
		],
		["archive toggle", { ...base, showArchived: true }, sort],
		[
			"sidebar flags",
			{ ...base, sidebarFilter: { ...EMPTY_FILTER, flags: [2] } },
			sort,
		],
		["sort direction", base, { column: "due", direction: "desc" } as const],
		["sort column", base, { column: "lapses", direction: "asc" } as const],
	])("changes when the %s changes", (_label, inputs, nextSort) => {
		expect(
			getBrowserQueryResetKey(combineBrowserFilters(inputs), nextSort),
		).not.toBe(getBrowserQueryResetKey(combineBrowserFilters(base), sort));
	});
});
