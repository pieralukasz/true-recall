/**
 * Browser View Types
 * Types for the Anki-style card browser
 */
import type { State } from "ts-fsrs";
import type { FSRSCardData } from "./fsrs/card.types";

/**
 * Extended card data for browser view
 * Includes source note info and projects from JOINs
 */
export interface BrowserCardItem extends FSRSCardData {
    /** Source note name (from JOIN source_notes) */
    sourceNoteName: string;
    /** Source note path (from JOIN source_notes) */
    sourceNotePath: string;
    /** Projects associated with this card (from JOIN note_projects/projects) */
    projects: string[];
}

/**
 * Available columns for sorting
 */
export type BrowserColumn =
    | "question"
    | "answer"
    | "due"
    | "state"
    | "stability"
    | "difficulty"
    | "lapses"
    | "reps"
    | "source"
    | "created"
    | "updated";

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * Sidebar filter state
 */
export interface SidebarFilters {
    /** Filter by state (null = all states) */
    stateFilter: State | "suspended" | "buried" | null;
    /** Filter by project (null = all projects) */
    projectFilter: string | null;
}

/**
 * Browser state managed by BrowserStateManager
 */
export interface BrowserState {
    /** All cards loaded from database */
    allCards: BrowserCardItem[];
    /** Cards after applying filters */
    filteredCards: BrowserCardItem[];
    /** IDs of selected cards for bulk operations */
    selectedCardIds: Set<string>;
    /** Current search query */
    searchQuery: string;
    /** Current sort column */
    sortColumn: BrowserColumn;
    /** Current sort direction */
    sortDirection: SortDirection;
    /** Sidebar filter state */
    sidebarFilters: SidebarFilters;
    /** Loading state */
    isLoading: boolean;
    /** Currently previewed card ID (null = no preview) */
    previewCardId: string | null;
    /** Last clicked card index (for Shift+click range selection) */
    lastClickedIndex: number | null;
}

/**
 * Partial state for setState updates
 */
export type PartialBrowserState = Partial<Omit<BrowserState, "selectedCardIds">> & {
    selectedCardIds?: Set<string> | string[];
};

/**
 * State listener callback type
 */
export type BrowserStateListener = (state: BrowserState, prevState: BrowserState) => void;

/**
 * Parsed search query token
 */
export interface SearchToken {
    /** Token type */
    type:
        | "text"        // Plain text search
        | "is"          // is:new, is:due, is:suspended, etc.
        | "source"      // source:xxx
        | "project"     // project:xxx
        | "prop"        // prop:stability>10
        | "created"     // created:7 (last 7 days)
        | "negation";   // -xxx (negates next token)
    /** Token value */
    value: string;
    /** Is this token negated? */
    negated: boolean;
    /** For prop tokens: operator */
    operator?: "<" | ">" | "=" | "<=" | ">=";
    /** For prop tokens: property name */
    property?: string;
    /** For prop tokens: numeric value */
    numericValue?: number;
}

/**
 * Card state badge info
 */
export interface CardStateBadge {
    /** Display label */
    label: string;
    /** CSS class for styling */
    cssClass: string;
}

/**
 * Sidebar item (project, tag, or state filter)
 */
export interface SidebarItem {
    /** Display label */
    label: string;
    /** Filter value to apply */
    value: string | State | null;
    /** Number of matching cards */
    count: number;
    /** Item type for styling */
    type: "state" | "project";
    /** Is this item currently selected? */
    isSelected: boolean;
}

/**
 * Bulk operation type
 */
export type BulkOperation =
    | "suspend"
    | "unsuspend"
    | "bury"
    | "unbury"
    | "delete"
    | "reset"
    | "reschedule";

/**
 * Result of a bulk operation
 */
export interface BulkOperationResult {
    /** Number of cards successfully updated */
    successCount: number;
    /** Number of cards that failed */
    failCount: number;
    /** Error message if any */
    error?: string;
}
