import type { FilterState, SortConfig } from "@true-recall/core/types/browser.types";
export interface SqlQuery {
    where: string;
    params: (string | number)[];
    orderBy: string;
    limit: number;
    offset: number;
}
export interface BuildQueryOptions {
    fts5Available?: boolean;
}
export declare function buildBrowserQuery(filter: FilterState, sort: SortConfig, limit: number, offset: number, options?: BuildQueryOptions): SqlQuery;
