import { type ReadonlySignal, type Signal, useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";

import { CardBrowserQueryService } from "@true-recall/core/services/browser/card-browser-query.service";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

import { Q, useQuery } from "@true-recall/obsidian/data";
import { useGatedComputed, usePlugin } from "@true-recall/obsidian/preact";

import {
	combineBrowserFilters,
	nextSortConfig,
	toggleListValue,
} from "../helpers/browser-filters";
import { createBrowserSuggestionProvider } from "../helpers/browser-suggestions";
import {
	BROWSER_PAGE_SIZE,
	getBrowserQueryResetKey,
} from "../helpers/infinite-scroll";
import {
	type BrowserResult,
	EMPTY_FILTER,
	type FilterState,
	type SortConfig,
	type StateFilterValue,
} from "../types";

// While the browser is visible, card-data changes rerun the SQL query at most
// this often; while hidden, not at all.
const RECOMPUTE_THROTTLE_MS = 2000;

interface CardBrowserQueryOptions {
	isViewVisible: ReadonlySignal<boolean>;
	/** One-shot request (from other views) to show a note's cards. */
	filterSourceUid?: Signal<string | null>;
	/** One-shot request (from other views) to show orphaned cards. */
	filterOrphaned?: Signal<boolean>;
}

/**
 * Filters, sorting, paging and the derived query results of the card browser.
 * Queries are gated by view visibility and throttled while visible; direct
 * user input (filters, sort, paging) recomputes immediately.
 */
export function useCardBrowserQuery({
	isViewVisible,
	filterSourceUid,
	filterOrphaned,
}: CardBrowserQueryOptions) {
	const plugin = usePlugin();

	const searchText = useSignal("");
	const stateFilters = useSignal<StateFilterValue[]>([]);
	const sidebarFilter = useSignal<FilterState>(EMPTY_FILTER);
	const showArchived = useSignal(false);
	const sort = useSignal<SortConfig>({ column: "due", direction: "asc" });
	const loadedLimit = useSignal(BROWSER_PAGE_SIZE);

	const requestedSourceUid = filterSourceUid?.value ?? null;
	useEffect(() => {
		if (!filterSourceUid || !requestedSourceUid) return;
		sidebarFilter.value = { ...EMPTY_FILTER, sourceUids: [requestedSourceUid] };
		filterSourceUid.value = null;
	}, [filterSourceUid, requestedSourceUid, sidebarFilter]);

	const orphanedRequested = filterOrphaned?.value ?? false;
	useEffect(() => {
		if (!filterOrphaned || !orphanedRequested) return;
		sidebarFilter.value = { ...EMPTY_FILTER, orphanedOnly: true };
		filterOrphaned.value = false;
	}, [filterOrphaned, orphanedRequested, sidebarFilter]);

	const queryService = useMemo(
		() =>
			new CardBrowserQueryService(
				plugin.cardStore,
				plugin.frontmatterIndex,
				plugin.hierarchyService,
			),
		[plugin],
	);

	// Both signals are read only inside the gated deps getters below, so a
	// hidden browser tab neither subscribes to nor requeries on data changes.
	// ALL_META changes with scheduling data; BROWSER_REVISION also changes on
	// content-only edits, which skip the ALL_META reload.
	const allCardsSignal = useQuery<Map<string, FSRSFlashcardItem>>(Q.ALL_META);
	const revisionSignal = useQuery<number>(Q.BROWSER_REVISION);

	const searchTextVal = searchText.value;
	const stateFiltersVal = stateFilters.value;
	const sidebarFilterVal = sidebarFilter.value;
	const showArchivedVal = showArchived.value;
	const sortVal = sort.value;
	const loadedLimitVal = loadedLimit.value;

	const filter = useMemo(
		() =>
			combineBrowserFilters({
				searchText: searchTextVal,
				stateFilters: stateFiltersVal,
				sidebarFilter: sidebarFilterVal,
				showArchived: showArchivedVal,
			}),
		[searchTextVal, stateFiltersVal, sidebarFilterVal, showArchivedVal],
	);

	const queryResetKey = useMemo(
		() => getBrowserQueryResetKey(filter, sortVal),
		[filter, sortVal],
	);

	// A new query starts from the first page. Until the effect below resets the
	// stored limit, the query already uses the first-page limit, so a filter
	// change never runs one extra query with the previous, larger limit.
	const appliedResetKeyRef = useRef(queryResetKey);
	const pageLimit =
		appliedResetKeyRef.current === queryResetKey
			? loadedLimitVal
			: BROWSER_PAGE_SIZE;
	useEffect(() => {
		appliedResetKeyRef.current = queryResetKey;
		loadedLimit.value = BROWSER_PAGE_SIZE;
	}, [queryResetKey, loadedLimit]);

	const result = useGatedComputed(
		(): BrowserResult => queryService.query(filter, sortVal, pageLimit, 0),
		() => [
			allCardsSignal.value,
			revisionSignal.value,
			queryService,
			filter,
			sortVal,
			pageLimit,
		],
		{ isVisible: isViewVisible, throttleMs: RECOMPUTE_THROTTLE_MS },
	);

	const facetCounts = useGatedComputed(
		() => queryService.getFacetCounts(showArchivedVal),
		() => [allCardsSignal.value, queryService, showArchivedVal],
		{ isVisible: isViewVisible, throttleMs: RECOMPUTE_THROTTLE_MS },
	);

	const orphanedCardIds = useGatedComputed(
		() => queryService.getOrphanedCardIds(),
		() => [allCardsSignal.value, queryService],
		{ isVisible: isViewVisible, throttleMs: RECOMPUTE_THROTTLE_MS },
	);

	const getSuggestions = useMemo(() => {
		const presetNames = plugin.presetService.getPresets().map((p) => p.name);
		const projectNames = plugin.hierarchyService
			.buildHierarchy()
			.map((n) => n.name)
			.sort();
		return createBrowserSuggestionProvider({
			sourceNotes: facetCounts.sourceNotes,
			presetNames,
			projectNames,
			tags: facetCounts.tags,
		});
	}, [plugin, facetCounts.sourceNotes, facetCounts.tags]);

	const setSearchText = useCallback(
		(value: string) => {
			searchText.value = value;
		},
		[searchText],
	);

	const toggleSort = useCallback(
		(column: string) => {
			sort.value = nextSortConfig(sort.value, column);
		},
		[sort],
	);

	const toggleStateFilter = useCallback(
		(state: StateFilterValue) => {
			stateFilters.value = toggleListValue(stateFilters.value, state);
		},
		[stateFilters],
	);

	const removeStateFilter = useCallback(
		(state: StateFilterValue) => {
			stateFilters.value = stateFilters.value.filter((s) => s !== state);
		},
		[stateFilters],
	);

	const updateSidebarFilter = useCallback(
		(partial: Partial<FilterState>) => {
			sidebarFilter.value = { ...sidebarFilter.value, ...partial };
		},
		[sidebarFilter],
	);

	const toggleShowArchived = useCallback(() => {
		showArchived.value = !showArchived.value;
	}, [showArchived]);

	const hasMore = result.cards.length < result.totalCount;

	const loadMore = useCallback(() => {
		if (!hasMore) return;
		loadedLimit.value += BROWSER_PAGE_SIZE;
	}, [hasMore, loadedLimit]);

	return {
		queryService,
		filter,
		queryResetKey,
		result,
		facetCounts,
		orphanedCardIds,
		getSuggestions,
		hasMore,
		searchText: searchTextVal,
		stateFilters: stateFiltersVal,
		sidebarFilter: sidebarFilterVal,
		showArchived: showArchivedVal,
		sort: sortVal,
		setSearchText,
		toggleSort,
		toggleStateFilter,
		removeStateFilter,
		updateSidebarFilter,
		toggleShowArchived,
		loadMore,
	};
}

export type CardBrowserQuery = ReturnType<typeof useCardBrowserQuery>;
