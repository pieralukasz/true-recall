import { useSignal } from "@preact/signals";
import { useCallback, useEffect } from "preact/hooks";

import type { CardBrowserQueryService } from "@true-recall/core/services/browser/card-browser-query.service";

import {
	applySelectionClick,
	retainMatchingIds,
	type SelectModifiers,
	toggleSelectAll,
	withoutIds,
} from "../helpers/browser-selection";
import type { BrowserResult, FilterState } from "../types";

interface BrowserSelectionOptions {
	queryService: CardBrowserQueryService;
	filter: FilterState;
	/** Current query result; a new object means the data or query changed. */
	result: BrowserResult;
}

/**
 * Selected card ids of the browser.
 *
 * The selection always stays a subset of the cards matching the current
 * query: after a filter change or a data mutation, ids that no longer match
 * are dropped, so bulk actions never touch hidden or deleted cards. "Select
 * all" selects every matching card, including pages that are not loaded.
 */
export function useBrowserSelection({
	queryService,
	filter,
	result,
}: BrowserSelectionOptions) {
	const selectedIds = useSignal<ReadonlySet<string>>(new Set());

	// `result` changes only when the gated query recomputes (visible view,
	// throttled), so reconciliation inherits the same gating.
	useEffect(() => {
		const selected = selectedIds.peek();
		if (selected.size === 0) return;
		const matching = new Set(queryService.getMatchingCardIds(filter));
		selectedIds.value = retainMatchingIds(selected, matching);
	}, [result, filter, queryService, selectedIds]);

	const select = useCallback(
		(cardId: string, modifiers?: SelectModifiers) => {
			selectedIds.value = applySelectionClick(
				selectedIds.value,
				cardId,
				modifiers,
				result.cards,
			);
		},
		[result.cards, selectedIds],
	);

	const selectAll = useCallback(() => {
		selectedIds.value = toggleSelectAll(
			selectedIds.value,
			result.totalCount,
			() => queryService.getMatchingCardIds(filter),
		);
	}, [filter, queryService, result.totalCount, selectedIds]);

	const clear = useCallback(() => {
		selectedIds.value = new Set();
	}, [selectedIds]);

	const remove = useCallback(
		(ids: Iterable<string>) => {
			selectedIds.value = withoutIds(selectedIds.value, ids);
		},
		[selectedIds],
	);

	return {
		selectedIds: selectedIds.value,
		select,
		selectAll,
		clear,
		remove,
	};
}

export type BrowserSelection = ReturnType<typeof useBrowserSelection>;
