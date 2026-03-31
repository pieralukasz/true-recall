import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { BrowserResult, FilterState, SortConfig } from "@true-recall/core/types/browser.types";
export declare class CardBrowserQueryService {
    private cardStore;
    private frontmatterIndex;
    private hierarchyService?;
    constructor(cardStore: SqliteStoreService, frontmatterIndex: FrontmatterIndexService, hierarchyService?: HierarchyService | undefined);
    query(filter: FilterState, sort: SortConfig, limit: number, offset: number): BrowserResult;
    /** Get sidebar facet counts (states, types, sources, etc.) */
    getFacetCounts(showArchived?: boolean): {
        states: Record<string, number>;
        cardTypes: Record<string, number>;
        createdVia: Record<string, number>;
        sourceNotes: {
            uid: string;
            name: string;
            count: number;
        }[];
    };
    /** Card IDs with no linked source note (null sourceUid or unresolved) */
    getOrphanedCardIds(): string[];
    /** Unique source UIDs that no longer resolve to a vault note */
    private getOrphanedSourceUids;
    private getArchivedSourceUids;
    private applyArchivedFilter;
    private resolveNoteFilters;
    private toBrowserCard;
}
