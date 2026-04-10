import type { FilterState, SortConfig } from "../types";

export const BROWSER_PAGE_SIZE = 200;
const LOAD_MORE_THRESHOLD_PX = 36 * 8;

interface ScrollMetrics {
	scrollTop: number;
	clientHeight: number;
	scrollHeight: number;
}

export function shouldLoadMoreCards(
	metrics: ScrollMetrics,
	hasMore: boolean,
	thresholdPx = LOAD_MORE_THRESHOLD_PX,
): boolean {
	if (!hasMore) return false;
	if (metrics.clientHeight <= 0 || metrics.scrollHeight <= 0) return false;

	return (
		metrics.scrollTop + metrics.clientHeight >=
		metrics.scrollHeight - thresholdPx
	);
}

export function getBrowserQueryResetKey(
	filter: FilterState,
	sort: SortConfig,
): string {
	return JSON.stringify({
		filter,
		sortColumn: sort.column,
		sortDirection: sort.direction,
	});
}

export function formatBrowserTotalCount(totalCount: number): string {
	return `${totalCount} cards`;
}
