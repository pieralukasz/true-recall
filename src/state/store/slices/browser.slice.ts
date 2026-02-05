import { State } from "ts-fsrs";
import type {
	AppState,
	AppStoreDeps,
	BrowserSliceState,
	BrowserSliceActions,
} from "../types";
import type {
	BrowserCardItem,
	BrowserColumn,
	SortDirection,
	SidebarFilters,
	SearchToken,
} from "../../../types/browser.types";
import { parseSearchQuery } from "../../../ui/browser/BrowserSearchParser";

type BrowserSlice = BrowserSliceState & BrowserSliceActions;

function createInitialState(): BrowserSliceState {
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

export function createBrowserSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps
): BrowserSlice {
	// Cache stored in closure - NOT in state (avoids triggering subscriptions)
	let cache: {
		stateCounts: {
			new: number;
			learning: number;
			review: number;
			relearning: number;
			suspended: number;
			buried: number;
		} | null;
		uniqueProjects: string[] | null;
		cardMap: Map<string, BrowserCardItem>;
	} = {
		stateCounts: null,
		uniqueProjects: null,
		cardMap: new Map(),
	};

	const invalidateCache = (): void => {
		cache.stateCounts = null;
		cache.uniqueProjects = null;
	};

	const buildCardMap = (cards: BrowserCardItem[]): void => {
		cache.cardMap.clear();
		for (const card of cards) {
			cache.cardMap.set(card.id, card);
		}
	};

	// Filtering helpers
	const applySidebarFilters = (cards: BrowserCardItem[]): BrowserCardItem[] => {
		const { stateFilter, projectFilter } = get().browser.sidebarFilters;
		const now = new Date();

		return cards.filter((card) => {
			if (stateFilter !== null) {
				if (stateFilter === "suspended") {
					if (!card.suspended) return false;
				} else if (stateFilter === "buried") {
					if (!card.buriedUntil || new Date(card.buriedUntil) <= now) return false;
				} else {
					if (card.state !== stateFilter) return false;
				}
			}

			if (projectFilter !== null) {
				if (!card.projects.includes(projectFilter)) return false;
			}

			return true;
		});
	};

	const cardMatchesToken = (card: BrowserCardItem, token: SearchToken): boolean => {
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
				return card.projects.some((p) =>
					p.toLowerCase().includes(token.value.toLowerCase())
				);

			case "prop": {
				if (!token.property || !token.operator || token.numericValue === undefined) {
					return false;
				}
				const propValue = getPropertyValue(card, token.property);
				if (propValue === null) return false;
				return compareValues(propValue, token.operator, token.numericValue);
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
	};

	const getPropertyValue = (card: BrowserCardItem, property: string): number | null => {
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
	};

	const compareValues = (a: number, op: string, b: number): boolean => {
		switch (op) {
			case "<":
				return a < b;
			case ">":
				return a > b;
			case "=":
				return a === b;
			case "<=":
				return a <= b;
			case ">=":
				return a >= b;
			default:
				return false;
		}
	};

	const cardMatchesTokens = (card: BrowserCardItem, tokens: SearchToken[]): boolean => {
		for (const token of tokens) {
			const matches = cardMatchesToken(card, token);
			if (token.negated ? matches : !matches) {
				return false;
			}
		}
		return true;
	};

	const applySearchQuery = (cards: BrowserCardItem[], query: string): BrowserCardItem[] => {
		const tokens = parseSearchQuery(query);
		if (tokens.length === 0) return cards;
		return cards.filter((card) => cardMatchesTokens(card, tokens));
	};

	const sortCards = (cards: BrowserCardItem[]): BrowserCardItem[] => {
		const { sortColumn, sortDirection } = get().browser;
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
					comparison = new Date(a.due).getTime() - new Date(b.due).getTime();
					break;
			}

			return comparison * modifier;
		});
	};

	const applyFiltersAndSort = (): void => {
		const state = get().browser;
		let cards = [...state.allCards];

		cards = applySidebarFilters(cards);

		if (state.searchQuery.trim()) {
			cards = applySearchQuery(cards, state.searchQuery);
		}

		cards = sortCards(cards);

		set((s) => ({
			browser: { ...s.browser, filteredCards: cards },
		}));
	};

	const initial = createInitialState();

	const slice: BrowserSlice = {
		// State
		allCards: initial.allCards,
		filteredCards: initial.filteredCards,
		selectedCardIds: initial.selectedCardIds,
		searchQuery: initial.searchQuery,
		sortColumn: initial.sortColumn,
		sortDirection: initial.sortDirection,
		sidebarFilters: initial.sidebarFilters,
		isLoading: initial.isLoading,
		previewCardId: initial.previewCardId,
		lastClickedIndex: initial.lastClickedIndex,

		setState: (partial: Partial<BrowserSliceState>) => {
			let selectedCardIds = get().browser.selectedCardIds;
			if (partial.selectedCardIds !== undefined) {
				selectedCardIds =
					partial.selectedCardIds instanceof Set
						? partial.selectedCardIds
						: new Set(partial.selectedCardIds);
			}

			set((s) => ({
				browser: {
					...s.browser,
					...partial,
					selectedCardIds,
				},
			}));
		},

		reset: () => {
			invalidateCache();
			cache.cardMap.clear();
			const initialState = createInitialState();
			set((s) => ({
				browser: {
					...s.browser,
					allCards: initialState.allCards,
					filteredCards: initialState.filteredCards,
					selectedCardIds: initialState.selectedCardIds,
					searchQuery: initialState.searchQuery,
					sortColumn: initialState.sortColumn,
					sortDirection: initialState.sortDirection,
					sidebarFilters: initialState.sidebarFilters,
					isLoading: initialState.isLoading,
					previewCardId: initialState.previewCardId,
					lastClickedIndex: initialState.lastClickedIndex,
				},
			}));
		},

		setCards: (cards: BrowserCardItem[]) => {
			buildCardMap(cards);
			invalidateCache();
			set((s) => ({
				browser: {
					...s.browser,
					allCards: cards,
					isLoading: false,
				},
			}));
			applyFiltersAndSort();
		},

		setLoading: (isLoading: boolean) => {
			set((s) => ({
				browser: { ...s.browser, isLoading },
			}));
		},

		setSearchQuery: (query: string) => {
			set((s) => ({
				browser: { ...s.browser, searchQuery: query },
			}));
			applyFiltersAndSort();
		},

		setSidebarFilters: (filters: Partial<SidebarFilters>) => {
			set((s) => ({
				browser: {
					...s.browser,
					sidebarFilters: {
						...s.browser.sidebarFilters,
						...filters,
					},
				},
			}));
			applyFiltersAndSort();
		},

		clearFilters: () => {
			set((s) => ({
				browser: {
					...s.browser,
					searchQuery: "",
					sidebarFilters: {
						stateFilter: null,
						projectFilter: null,
					},
				},
			}));
			applyFiltersAndSort();
		},

		setSortColumn: (column: BrowserColumn) => {
			set((s) => {
				if (s.browser.sortColumn === column) {
					return {
						browser: {
							...s.browser,
							sortDirection: s.browser.sortDirection === "asc" ? "desc" : "asc",
						},
					};
				}
				return {
					browser: {
						...s.browser,
						sortColumn: column,
						sortDirection: "asc",
					},
				};
			});
			applyFiltersAndSort();
		},

		setSortDirection: (direction: SortDirection) => {
			set((s) => ({
				browser: { ...s.browser, sortDirection: direction },
			}));
			applyFiltersAndSort();
		},

		toggleCardSelection: (cardId: string) => {
			const state = get().browser;
			const newSelection = new Set(state.selectedCardIds);
			if (newSelection.has(cardId)) {
				newSelection.delete(cardId);
			} else {
				newSelection.add(cardId);
			}

			const index = state.filteredCards.findIndex((c) => c.id === cardId);
			set((s) => ({
				browser: {
					...s.browser,
					selectedCardIds: newSelection,
					lastClickedIndex: index >= 0 ? index : null,
				},
			}));
		},

		selectRange: (toIndex: number) => {
			const state = get().browser;
			if (state.lastClickedIndex === null) {
				const card = state.filteredCards[toIndex];
				if (card) {
					get().browser.toggleCardSelection(card.id);
				}
				return;
			}

			const fromIndex = state.lastClickedIndex;
			const start = Math.min(fromIndex, toIndex);
			const end = Math.max(fromIndex, toIndex);

			const newSelection = new Set(state.selectedCardIds);
			for (let i = start; i <= end; i++) {
				const card = state.filteredCards[i];
				if (card) {
					newSelection.add(card.id);
				}
			}

			set((s) => ({
				browser: { ...s.browser, selectedCardIds: newSelection },
			}));
		},

		selectAll: () => {
			const newSelection = new Set(get().browser.filteredCards.map((c) => c.id));
			set((s) => ({
				browser: { ...s.browser, selectedCardIds: newSelection },
			}));
		},

		clearSelection: () => {
			set((s) => ({
				browser: {
					...s.browser,
					selectedCardIds: new Set(),
					lastClickedIndex: null,
				},
			}));
		},

		getSelectedCards: () => {
			const state = get().browser;
			return state.filteredCards.filter((c) => state.selectedCardIds.has(c.id));
		},

		setPreviewCard: (cardId: string | null) => {
			set((s) => ({
				browser: { ...s.browser, previewCardId: cardId },
			}));
		},

		getPreviewCard: () => {
			const previewCardId = get().browser.previewCardId;
			if (!previewCardId) return null;
			return cache.cardMap.get(previewCardId) ?? null;
		},

		updateCard: (cardId: string, updates: Partial<BrowserCardItem>) => {
			const allCards = get().browser.allCards.map((c) =>
				c.id === cardId ? { ...c, ...updates } : c
			);

			buildCardMap(allCards);
			invalidateCache();

			set((s) => ({
				browser: { ...s.browser, allCards },
			}));
			applyFiltersAndSort();
		},

		removeCards: (cardIds: string[]) => {
			const cardIdSet = new Set(cardIds);
			const state = get().browser;

			const allCards = state.allCards.filter((c) => !cardIdSet.has(c.id));
			const selectedCardIds = new Set(
				[...state.selectedCardIds].filter((id) => !cardIdSet.has(id))
			);
			const previewCardId =
				state.previewCardId && cardIdSet.has(state.previewCardId)
					? null
					: state.previewCardId;

			buildCardMap(allCards);
			invalidateCache();

			set((s) => ({
				browser: {
					...s.browser,
					allCards,
					selectedCardIds,
					previewCardId,
				},
			}));
			applyFiltersAndSort();
		},

		getUniqueProjects: () => {
			if (cache.uniqueProjects) {
				return cache.uniqueProjects;
			}

			const projects = new Set<string>();
			for (const card of get().browser.allCards) {
				for (const project of card.projects) {
					projects.add(project);
				}
			}
			cache.uniqueProjects = [...projects].sort();
			return cache.uniqueProjects;
		},

		getStateCounts: () => {
			if (cache.stateCounts) {
				return cache.stateCounts;
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

			for (const card of get().browser.allCards) {
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

			cache.stateCounts = counts;
			return counts;
		},
	};

	return slice;
}
