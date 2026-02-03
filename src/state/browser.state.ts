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
        },
        isLoading: true,
        previewCardId: null,
        lastClickedIndex: null,
    };
}

export class BrowserStateManager {
    private state: BrowserState;
    private listeners: Set<BrowserStateListener> = new Set();

    // Memoization cache for expensive computations
    private cache: {
        stateCounts: { new: number; learning: number; review: number; relearning: number; suspended: number; buried: number } | null;
        uniqueProjects: string[] | null;
        cardMap: Map<string, BrowserCardItem>;
    } = {
        stateCounts: null,
        uniqueProjects: null,
        cardMap: new Map(),
    };

    constructor() {
        this.state = createInitialState();
    }

    private invalidateCache(): void {
        this.cache.stateCounts = null;
        this.cache.uniqueProjects = null;
    }

    private buildCardMap(cards: BrowserCardItem[]): void {
        this.cache.cardMap.clear();
        for (const card of cards) {
            this.cache.cardMap.set(card.id, card);
        }
    }

    getState(): BrowserState {
        return {
            ...this.state,
            allCards: [...this.state.allCards],
            filteredCards: [...this.state.filteredCards],
            selectedCardIds: new Set(this.state.selectedCardIds),
            sidebarFilters: { ...this.state.sidebarFilters },
        };
    }

    setState(partial: PartialBrowserState): void {
        const prevState = this.state;
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

    subscribe(listener: BrowserStateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    reset(): void {
        const prevState = this.state;
        this.state = createInitialState();
        this.notifyListeners(prevState);
    }

    setCards(cards: BrowserCardItem[]): void {
        this.state.allCards = cards;
        this.state.isLoading = false;
        this.buildCardMap(cards);
        this.invalidateCache();
        this.applyFiltersAndSort();
    }

    setLoading(isLoading: boolean): void {
        this.setState({ isLoading });
    }

    setSearchQuery(query: string): void {
        this.state.searchQuery = query;
        this.applyFiltersAndSort();
    }

    setSidebarFilters(filters: Partial<SidebarFilters>): void {
        this.state.sidebarFilters = {
            ...this.state.sidebarFilters,
            ...filters,
        };
        this.applyFiltersAndSort();
    }

    clearFilters(): void {
        this.state.searchQuery = "";
        this.state.sidebarFilters = {
            stateFilter: null,
            projectFilter: null,
        };
        this.applyFiltersAndSort();
    }

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

    setSortDirection(direction: SortDirection): void {
        this.state.sortDirection = direction;
        this.applyFiltersAndSort();
    }

    toggleCardSelection(cardId: string): void {
        const newSelection = new Set(this.state.selectedCardIds);
        if (newSelection.has(cardId)) {
            newSelection.delete(cardId);
        } else {
            newSelection.add(cardId);
        }

        const index = this.state.filteredCards.findIndex(c => c.id === cardId);
        this.state.lastClickedIndex = index >= 0 ? index : null;

        this.setState({ selectedCardIds: newSelection });
    }

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

    selectAll(): void {
        const newSelection = new Set(this.state.filteredCards.map(c => c.id));
        this.setState({ selectedCardIds: newSelection });
    }

    clearSelection(): void {
        this.state.lastClickedIndex = null;
        this.setState({ selectedCardIds: new Set() });
    }

    getSelectedCards(): BrowserCardItem[] {
        return this.state.filteredCards.filter(c => this.state.selectedCardIds.has(c.id));
    }

    setPreviewCard(cardId: string | null): void {
        this.setState({ previewCardId: cardId });
    }

    getPreviewCard(): BrowserCardItem | null {
        if (!this.state.previewCardId) return null;
        return this.cache.cardMap.get(this.state.previewCardId) ?? null;
    }

    updateCard(cardId: string, updates: Partial<BrowserCardItem>): void {
        const prevState = this.state;

        this.state.allCards = this.state.allCards.map(c =>
            c.id === cardId ? { ...c, ...updates } : c
        );

        // Rebuild cardMap and invalidate cache
        this.buildCardMap(this.state.allCards);
        this.invalidateCache();

        this.applyFiltersAndSort();
        this.notifyListeners(prevState);
    }

    removeCards(cardIds: string[]): void {
        const cardIdSet = new Set(cardIds);
        const prevState = this.state;

        this.state.allCards = this.state.allCards.filter(c => !cardIdSet.has(c.id));
        this.state.selectedCardIds = new Set(
            [...this.state.selectedCardIds].filter(id => !cardIdSet.has(id))
        );

        if (this.state.previewCardId && cardIdSet.has(this.state.previewCardId)) {
            this.state.previewCardId = null;
        }

        // Rebuild cardMap and invalidate cache
        this.buildCardMap(this.state.allCards);
        this.invalidateCache();

        this.applyFiltersAndSort();
        this.notifyListeners(prevState);
    }

    /** Memoized */
    getUniqueProjects(): string[] {
        if (this.cache.uniqueProjects) {
            return this.cache.uniqueProjects;
        }

        const projects = new Set<string>();
        for (const card of this.state.allCards) {
            for (const project of card.projects) {
                projects.add(project);
            }
        }
        this.cache.uniqueProjects = [...projects].sort();
        return this.cache.uniqueProjects;
    }

    /** Memoized */
    getStateCounts(): { new: number; learning: number; review: number; relearning: number; suspended: number; buried: number } {
        if (this.cache.stateCounts) {
            return this.cache.stateCounts;
        }

        const counts = {
            new: 0,
            learning: 0,
            review: 0,
            relearning: 0,
            suspended: 0,
            buried: 0,
        };

        const now = Date.now();

        for (const card of this.state.allCards) {
            if (card.suspended) {
                counts.suspended++;
            } else if (card.buriedUntil && new Date(card.buriedUntil).getTime() > now) {
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

        this.cache.stateCounts = counts;
        return counts;
    }

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

    private applySidebarFilters(cards: BrowserCardItem[]): BrowserCardItem[] {
        const { stateFilter, projectFilter } = this.state.sidebarFilters;
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

            return true;
        });
    }

    private applySearchQuery(cards: BrowserCardItem[], query: string): BrowserCardItem[] {
        const tokens = parseSearchQuery(query);
        if (tokens.length === 0) return cards;

        return cards.filter(card => this.cardMatchesTokens(card, tokens));
    }

    private cardMatchesTokens(card: BrowserCardItem, tokens: SearchToken[]): boolean {
        for (const token of tokens) {
            const matches = this.cardMatchesToken(card, token);
            if (token.negated ? matches : !matches) {
                return false;
            }
        }
        return true;
    }

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

export function createBrowserStateManager(): BrowserStateManager {
    return new BrowserStateManager();
}
