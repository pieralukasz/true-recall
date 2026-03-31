export const BROWSER_PAGE_SIZE = 200;
export const LOAD_MORE_THRESHOLD_PX = 36 * 8;
export function shouldLoadMoreCards(metrics, hasMore, thresholdPx = LOAD_MORE_THRESHOLD_PX) {
    if (!hasMore)
        return false;
    if (metrics.clientHeight <= 0 || metrics.scrollHeight <= 0)
        return false;
    return (metrics.scrollTop + metrics.clientHeight >=
        metrics.scrollHeight - thresholdPx);
}
export function getBrowserQueryResetKey(filter, sort) {
    return JSON.stringify({
        filter,
        sortColumn: sort.column,
        sortDirection: sort.direction,
    });
}
export function formatBrowserTotalCount(totalCount) {
    return `${totalCount} cards`;
}
