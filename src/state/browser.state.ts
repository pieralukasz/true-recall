/**
 * Browser State Manager
 * Centralized state management for the card browser view
 */
import { State } from "ts-fsrs";
import type {
    BrowserState,
    BrowserStateListener,
    PartialBrowserState,
    BrowserCardItem,
    BrowserColumn,
    SortDirection,
    SidebarFilters,
    SearchToken,
} from "../types/browser.types";
import { parseSearchQuery } from "../ui/browser/BrowserSearchParser";

/**
 * Creates the initial browser state
 */
function createInitialState(): BrowserState {
    return {
        allCards: [],
        filteredCards: [],
        selectedCardIds: new Set(),
        searchQuery: "",
        sortColumn: "due",
        sortDirection: "asc",
        sidebarFilters: {
            stateFilter: null,
            projectFilter: null,
            tagFilter: null,
        },
        isLoading: true,
        previewCardId: null,
        lastClickedIndex: null,
    };
}

/**
 * State manager for the browser view
 */
export class BrowserStateManager {
    private state: BrowserState;
    private listeners: Set<BrowserStateListener> = new Set();

    constructor() {
        this.state = createInitialState();
    }

    /**
     * Get current state (immutable copy)
     */
    getState(): BrowserState {
        return {
            ...this.state,
            allCards: [...this.state.allCards],
            filteredCards: [...this.state.filteredCards],
            selectedCardIds: new Set(this.state.selectedCardIds),
            sidebarFilters: { ...this.state.sidebarFilters },
        };
    }

    /**
     * Update state with partial updates
     */
    setState(partial: PartialBrowserState): void {
        const prevState = this.state;

        // Handle selectedCardIds conversion
        let selectedCardIds = this.state.selectedCardIds;
        if (partial.selectedCardIds !== undefined) {
            selectedCardIds = partial.selectedCardIds instanceof Set
                ? partial.selectedCardIds
                : new Set(partial.selectedCardIds);
        }

        this.state = {
            ...this.state,
            ...partial,
            selectedCardIds,
        };
        this.notifyListeners(prevState);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: BrowserStateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Reset state to initial values
     */
    reset(): void {
        const prevState = this.state;
        this.state = createInitialState();
        this.notifyListeners(prevState);
    }

    // ===== Data Loading =====

    /**
     * Set all cards and apply filters
     */
    setCards(cards: BrowserCardItem[]): void {
        this.state.allCards = cards;
        this.state.isLoading = false;
        this.applyFiltersAndSort();
    }

    /**
     * Set loading state
     */
    setLoading(isLoading: boolean): void {
        this.setState({ isLoading });
    }

    // ===== Search & Filters =====

    /**
     * Set search query and apply filters
     */
    setSearchQuery(query: string): void {
        this.state.searchQuery = query;
        this.applyFiltersAndSort();
    }

    /**
     * Set sidebar filters and apply
     */
    setSidebarFilters(filters: Partial<SidebarFilters>): void {
        this.state.sidebarFilters = {
            ...this.state.sidebarFilters,
            ...filters,
        };
        this.applyFiltersAndSort();
    }

    /**
     * Clear all filters
     */
    clearFilters(): void {
        this.state.searchQuery = "";
        this.state.sidebarFilters = {
            stateFilter: null,
            projectFilter: null,
            tagFilter: null,
        };
        this.applyFiltersAndSort();
    }

    // ===== Sorting =====

    /**
     * Set sort column and direction
     */
    setSortColumn(column: BrowserColumn): void {
        if (this.state.sortColumn === column) {
            // Toggle direction if same column
            this.state.sortDirection = this.state.sortDirection === "asc" ? "desc" : "asc";
        } else {
            this.state.sortColumn = column;
            this.state.sortDirection = "asc";
        }
        this.applyFiltersAndSort();
    }

    /**
     * Set sort direction explicitly
     */
    setSortDirection(direction: SortDirection): void {
        this.state.sortDirection = direction;
        this.applyFiltersAndSort();
    }

    // ===== Selection =====

    /**
     * Toggle card selection
     */
    toggleCardSelection(cardId: string): void {
        const newSelection = new Set(this.state.selectedCardIds);
        if (newSelection.has(cardId)) {
            newSelection.delete(cardId);
        } else {
            newSelection.add(cardId);
        }

        // Update lastClickedIndex
        const index = this.state.filteredCards.findIndex(c => c.id === cardId);
        this.state.lastClickedIndex = index >= 0 ? index : null;

        this.setState({ selectedCardIds: newSelection });
    }

    /**
     * Select a range of cards (Shift+click behavior)
     */
    selectRange(toIndex: number): void {
        if (this.state.lastClickedIndex === null) {
            // No previous click, just select the clicked card
            const card = this.state.filteredCards[toIndex];
            if (card) {
                this.toggleCardSelection(card.id);
            }
            return;
        }

        const fromIndex = this.state.lastClickedIndex;
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);

        const newSelection = new Set(this.state.selectedCardIds);
        for (let i = start; i <= end; i++) {
            const card = this.state.filteredCards[i];
            if (card) {
                newSelection.add(card.id);
            }
        }

        this.setState({ selectedCardIds: newSelection });
    }

    /**
     * Select all filtered cards
     */
    selectAll(): void {
        const newSelection = new Set(this.state.filteredCards.map(c => c.id));
        this.setState({ selectedCardIds: newSelection });
    }

    /**
     * Clear selection
     */
    clearSelection(): void {
        this.state.lastClickedIndex = null;
        this.setState({ selectedCardIds: new Set() });
    }

    /**
     * Get selected cards
     */
    getSelectedCards(): BrowserCardItem[] {
        return this.state.filteredCards.filter(c => this.state.selectedCardIds.has(c.id));
    }

    // ===== Preview =====

    /**
     * Set the previewed card
     */
    setPreviewCard(cardId: string | null): void {
        this.setState({ previewCardId: cardId });
    }

    /**
     * Get the previewed card
     */
    getPreviewCard(): BrowserCardItem | null {
        if (!this.state.previewCardId) return null;
        return this.state.allCards.find(c => c.id === this.state.previewCardId) ?? null;
    }

    // ===== Card Updates =====

    /**
     * Update a card in the state (after edit)
     */
    updateCard(cardId: string, updates: Partial<BrowserCardItem>): void {
        const prevState = this.state;

        this.state.allCards = this.state.allCards.map(c =>
            c.id === cardId ? { ...c, ...updates } : c
        );

        this.applyFiltersAndSort();
        this.notifyListeners(prevState);
    }

    /**
     * Remove cards from state (after deletion or bulk operation)
     */
    removeCards(cardIds: string[]): void {
        const cardIdSet = new Set(cardIds);
        const prevState = this.state;

        this.state.allCards = this.state.allCards.filter(c => !cardIdSet.has(c.id));
        this.state.selectedCardIds = new Set(
            [...this.state.selectedCardIds].filter(id => !cardIdSet.has(id))
        );

        // Clear preview if removed
        if (this.state.previewCardId && cardIdSet.has(this.state.previewCardId)) {
            this.state.previewCardId = null;
        }

        this.applyFiltersAndSort();
        this.notifyListeners(prevState);
    }

    // ===== Aggregations =====

    /**
     * Get unique projects from all cards
     */
    getUniqueProjects(): string[] {
        const projects = new Set<string>();
        for (const card of this.state.allCards) {
            for (const project of card.projects) {
                projects.add(project);
            }
        }
        return [...projects].sort();
    }

    /**
     * Get unique tags from all cards
     */
    getUniqueTags(): string[] {
        const tags = new Set<string>();
        for (const card of this.state.allCards) {
            if (card.tags) {
                for (const tag of card.tags) {
                    tags.add(tag);
                }
            }
        }
        return [...tags].sort();
    }

    /**
     * Get card counts by state
     */
    getStateCounts(): { new: number; learning: number; review: number; relearning: number; suspended: number; buried: number } {
        const counts = {
            new: 0,
            learning: 0,
            review: 0,
            relearning: 0,
            suspended: 0,
            buried: 0,
        };

        const now = new Date();

        for (const card of this.state.allCards) {
            if (card.suspended) {
                counts.suspended++;
            } else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
                counts.buried++;
            } else {
                switch (card.state) {
                    case State.New:
                        counts.new++;
                        break;
                    case State.Learning:
                        counts.learning++;
                        break;
                    case State.Review:
                        counts.review++;
                        break;
                    case State.Relearning:
                        counts.relearning++;
                        break;
                }
            }
        }

        return counts;
    }

    // ===== Private Methods =====

    /**
     * Apply all filters and sorting to allCards
     */
    private applyFiltersAndSort(): void {
        const prevState = this.state;
        let cards = [...this.state.allCards];

        // Apply sidebar filters
        cards = this.applySidebarFilters(cards);

        // Apply search query
        if (this.state.searchQuery.trim()) {
            cards = this.applySearchQuery(cards, this.state.searchQuery);
        }

        // Apply sorting
        cards = this.sortCards(cards);

        this.state.filteredCards = cards;
        this.notifyListeners(prevState);
    }

    /**
     * Apply sidebar filters
     */
    private applySidebarFilters(cards: BrowserCardItem[]): BrowserCardItem[] {
        const { stateFilter, projectFilter, tagFilter } = this.state.sidebarFilters;
        const now = new Date();

        return cards.filter(card => {
            // State filter
            if (stateFilter !== null) {
                if (stateFilter === "suspended") {
                    if (!card.suspended) return false;
                } else if (stateFilter === "buried") {
                    if (!card.buriedUntil || new Date(card.buriedUntil) <= now) return false;
                } else {
                    // It's a State enum value
                    if (card.state !== stateFilter) return false;
                }
            }

            // Project filter
            if (projectFilter !== null) {
                if (!card.projects.includes(projectFilter)) return false;
            }

            // Tag filter
            if (tagFilter !== null) {
                if (!card.tags?.includes(tagFilter)) return false;
            }

            return true;
        });
    }

    /**
     * Apply search query with Anki-style syntax
     */
    private applySearchQuery(cards: BrowserCardItem[], query: string): BrowserCardItem[] {
        const tokens = parseSearchQuery(query);
        if (tokens.length === 0) return cards;

        return cards.filter(card => this.cardMatchesTokens(card, tokens));
    }

    /**
     * Check if a card matches all search tokens
     */
    private cardMatchesTokens(card: BrowserCardItem, tokens: SearchToken[]): boolean {
        for (const token of tokens) {
            const matches = this.cardMatchesToken(card, token);
            if (token.negated ? matches : !matches) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if a card matches a single token
     */
    private cardMatchesToken(card: BrowserCardItem, token: SearchToken): boolean {
        const now = new Date();

        switch (token.type) {
            case "text": {
                const searchValue = token.value.toLowerCase();
                return (
                    (card.question?.toLowerCase().includes(searchValue) ?? false) ||
                    (card.answer?.toLowerCase().includes(searchValue) ?? false)
                );
            }

            case "is": {
                const value = token.value.toLowerCase();
                switch (value) {
                    case "new":
                        return card.state === State.New;
                    case "learning":
                        return card.state === State.Learning || card.state === State.Relearning;
                    case "review":
                        return card.state === State.Review;
                    case "due": {
                        const dueDate = new Date(card.due);
                        return dueDate <= now;
                    }
                    case "suspended":
                        return card.suspended === true;
                    case "buried":
                        return !!(card.buriedUntil && new Date(card.buriedUntil) > now);
                    default:
                        return false;
                }
            }

            case "tag":
                return card.tags?.some(t =>
                    t.toLowerCase().includes(token.value.toLowerCase())
                ) ?? false;

            case "source":
                return card.sourceNoteName?.toLowerCase().includes(token.value.toLowerCase()) ?? false;

            case "project":
                return card.projects.some(p =>
                    p.toLowerCase().includes(token.value.toLowerCase())
                );

            case "prop": {
                if (!token.property || !token.operator || token.numericValue === undefined) {
                    return false;
                }
                const propValue = this.getPropertyValue(card, token.property);
                if (propValue === null) return false;
                return this.compareValues(propValue, token.operator, token.numericValue);
            }

            case "created": {
                const days = parseInt(token.value, 10);
                if (isNaN(days)) return false;
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - days);
                const createdAt = card.createdAt ? new Date(card.createdAt) : null;
                return createdAt !== null && createdAt >= cutoff;
            }

            default:
                return false;
        }
    }

    /**
     * Get a property value from a card for prop: queries
     */
    private getPropertyValue(card: BrowserCardItem, property: string): number | null {
        switch (property.toLowerCase()) {
            case "stability":
                return card.stability;
            case "difficulty":
                return card.difficulty;
            case "lapses":
                return card.lapses;
            case "reps":
                return card.reps;
            case "interval":
            case "scheduleddays":
                return card.scheduledDays;
            default:
                return null;
        }
    }

    /**
     * Compare two values with an operator
     */
    private compareValues(a: number, op: string, b: number): boolean {
        switch (op) {
            case "<": return a < b;
            case ">": return a > b;
            case "=": return a === b;
            case "<=": return a <= b;
            case ">=": return a >= b;
            default: return false;
        }
    }

    /**
     * Sort cards by current column and direction
     */
    private sortCards(cards: BrowserCardItem[]): BrowserCardItem[] {
        const { sortColumn, sortDirection } = this.state;
        const modifier = sortDirection === "asc" ? 1 : -1;

        return [...cards].sort((a, b) => {
            let comparison = 0;

            switch (sortColumn) {
                case "question":
                    comparison = (a.question ?? "").localeCompare(b.question ?? "");
                    break;
                case "answer":
                    comparison = (a.answer ?? "").localeCompare(b.answer ?? "");
                    break;
                case "due":
                    comparison = new Date(a.due).getTime() - new Date(b.due).getTime();
                    break;
                case "state":
                    comparison = a.state - b.state;
                    break;
                case "stability":
                    comparison = a.stability - b.stability;
                    break;
                case "difficulty":
                    comparison = a.difficulty - b.difficulty;
                    break;
                case "lapses":
                    comparison = a.lapses - b.lapses;
                    break;
                case "reps":
                    comparison = a.reps - b.reps;
                    break;
                case "source":
                    comparison = (a.sourceNoteName ?? "").localeCompare(b.sourceNoteName ?? "");
                    break;
                case "created":
                    comparison = (a.createdAt ?? 0) - (b.createdAt ?? 0);
                    break;
                case "updated":
                    // Use due as proxy for updated (could add updatedAt field later)
                    comparison = new Date(a.due).getTime() - new Date(b.due).getTime();
                    break;
            }

            return comparison * modifier;
        });
    }

    /**
     * Notify all listeners of state change
     */
    private notifyListeners(prevState: BrowserState): void {
        const currentState = this.state;
        this.listeners.forEach(listener => {
            try {
                listener(currentState, prevState);
            } catch (error) {
                console.error("[BrowserStateManager] Error in state listener:", error);
            }
        });
    }
}

/**
 * Create a new BrowserStateManager instance
 */
export function createBrowserStateManager(): BrowserStateManager {
    return new BrowserStateManager();
}
