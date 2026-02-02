import type { State } from "ts-fsrs";
import type { FSRSCardData } from "./fsrs/card.types";

export interface BrowserCardItem extends FSRSCardData {
    sourceNoteName: string;
    sourceNotePath: string;
    projects: string[];
}

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

export type SortDirection = "asc" | "desc";

export interface SidebarFilters {
    stateFilter: State | "suspended" | "buried" | null;
    projectFilter: string | null;
}

export interface BrowserState {
    allCards: BrowserCardItem[];
    filteredCards: BrowserCardItem[];
    selectedCardIds: Set<string>;
    searchQuery: string;
    sortColumn: BrowserColumn;
    sortDirection: SortDirection;
    sidebarFilters: SidebarFilters;
    isLoading: boolean;
    previewCardId: string | null;
    lastClickedIndex: number | null;
}

export type PartialBrowserState = Partial<Omit<BrowserState, "selectedCardIds">> & {
    selectedCardIds?: Set<string> | string[];
};

export type BrowserStateListener = (state: BrowserState, prevState: BrowserState) => void;

export interface SearchToken {
    type:
        | "text"        // Plain text search
        | "is"          // is:new, is:due, is:suspended, etc.
        | "source"      // source:xxx
        | "project"     // project:xxx
        | "prop"        // prop:stability>10
        | "created"     // created:7 (last 7 days)
        | "negation";
    value: string;
    negated: boolean;
    operator?: "<" | ">" | "=" | "<=" | ">=";
    property?: string;
    numericValue?: number;
}

export type BulkOperation =
    | "suspend"
    | "unsuspend"
    | "bury"
    | "unbury"
    | "delete"
    | "reset"
    | "reschedule";

