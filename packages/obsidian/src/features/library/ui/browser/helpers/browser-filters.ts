import { parseSearchQuery } from "@true-recall/core/helpers/search-parser";

import type { FilterState, SortConfig, StateFilterValue } from "../types";

export interface BrowserFilterInputs {
	/** Raw text from the search box, parsed with the browser search grammar. */
	searchText: string;
	/** State chips toggled in the toolbar. */
	stateFilters: readonly StateFilterValue[];
	/** Facets chosen in the sidebar (and external "show cards of" requests). */
	sidebarFilter: FilterState;
	showArchived: boolean;
}

/**
 * Merge the search box, toolbar chips and sidebar facets into the single
 * filter the query service runs. Values of one facet are concatenated, so the
 * query builder matches any of them (IN / OR); different facets narrow each
 * other (AND).
 */
export function combineBrowserFilters({
	searchText,
	stateFilters,
	sidebarFilter,
	showArchived,
}: BrowserFilterInputs): FilterState {
	const parsed = parseSearchQuery(searchText);
	return {
		...parsed,
		states: [...parsed.states, ...stateFilters, ...sidebarFilter.states],
		sourceUids: [...parsed.sourceUids, ...sidebarFilter.sourceUids],
		cardTypes: [...parsed.cardTypes, ...sidebarFilter.cardTypes],
		createdVia: [...parsed.createdVia, ...sidebarFilter.createdVia],
		negatedStates: [...parsed.negatedStates, ...sidebarFilter.negatedStates],
		flags: [...parsed.flags, ...sidebarFilter.flags],
		showArchived,
		orphanedOnly: parsed.orphanedOnly || sidebarFilter.orphanedOnly,
	};
}

/** Clicking the active column flips direction; a new column starts ascending. */
export function nextSortConfig(
	current: SortConfig,
	column: string,
): SortConfig {
	if (current.column !== column) return { column, direction: "asc" };
	return {
		column,
		direction: current.direction === "asc" ? "desc" : "asc",
	};
}

export function toggleListValue<T>(list: readonly T[], value: T): T[] {
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list, value];
}
