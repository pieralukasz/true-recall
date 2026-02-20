import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "@shared/types";
import { createSelectionActions } from "@shared/store/helpers/slice-helpers";
import type {
	AppState,
	AppStoreDeps,
	BrowserSliceActions,
	BrowserSliceState,
	BrowserSortColumn,
	BrowserStateFilter,
} from "@shared/store/types";

type BrowserSlice = BrowserSliceState & BrowserSliceActions;

function createInitialState(): BrowserSliceState {
	return {
		isLoading: true,
		allCards: [],
		searchQuery: "",
		stateFilter: "all",
		sortColumn: "due",
		sortDirection: "asc",
		selectionMode: "normal",
		selectedCardIds: new Set<string>(),
		previewCardId: null,
	};
}

function matchesSearch(card: FSRSFlashcardItem, query: string): boolean {
	if (!query) return true;
	const q = query.toLowerCase();
	return (
		card.question.toLowerCase().includes(q) ||
		card.answer.toLowerCase().includes(q) ||
		(card.sourceNoteName?.toLowerCase().includes(q) ?? false)
	);
}

function matchesStateFilter(
	card: FSRSFlashcardItem,
	filter: BrowserStateFilter,
): boolean {
	if (filter === "all") return true;

	const now = new Date();
	if (filter === "suspended") return card.fsrs.suspended === true;
	if (filter === "buried") {
		return !!card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now;
	}

	// Exclude suspended/buried from FSRS state filters
	if (card.fsrs.suspended) return false;
	if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
		return false;

	switch (filter) {
		case "new":
			return card.fsrs.state === State.New;
		case "learning":
			return card.fsrs.state === State.Learning;
		case "review":
			return card.fsrs.state === State.Review;
		case "relearning":
			return card.fsrs.state === State.Relearning;
	}
}

function compareCards(
	a: FSRSFlashcardItem,
	b: FSRSFlashcardItem,
	column: BrowserSortColumn,
	direction: "asc" | "desc",
): number {
	const mod = direction === "asc" ? 1 : -1;

	switch (column) {
		case "question":
			return mod * a.question.localeCompare(b.question);
		case "answer":
			return mod * a.answer.localeCompare(b.answer);
		case "state":
			return mod * (a.fsrs.state - b.fsrs.state);
		case "due":
			return (
				mod * (new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())
			);
		case "interval":
			return mod * (a.fsrs.scheduledDays - b.fsrs.scheduledDays);
		case "lapses":
			return mod * (a.fsrs.lapses - b.fsrs.lapses);
		case "stability":
			return mod * (a.fsrs.stability - b.fsrs.stability);
		case "difficulty":
			return mod * (a.fsrs.difficulty - b.fsrs.difficulty);
		case "source":
			return (
				mod * (a.sourceNoteName ?? "").localeCompare(b.sourceNoteName ?? "")
			);
	}
}

export function createBrowserSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps,
): BrowserSlice {
	const initial = createInitialState();

	// Memoization cache for getFilteredAndSortedCards — avoids O(N log N) on every render
	let filteredCache: FSRSFlashcardItem[] | null = null;
	let filteredCacheKey = "";

	const selection = createSelectionActions(
		set,
		get,
		"browser",
		"selectionMode",
		"selectedCardIds",
	);

	const slice: BrowserSlice = {
		...initial,

		setState: (partial: Partial<BrowserSliceState>) => {
			set((s) => ({
				browser: { ...s.browser, ...partial },
			}));
		},

		reset: () => {
			set((s) => ({
				browser: { ...s.browser, ...createInitialState() },
			}));
		},

		setLoading: (isLoading: boolean) => {
			set((s) => ({
				browser: { ...s.browser, isLoading },
			}));
		},

		setCards: (cards: FSRSFlashcardItem[]) => {
			filteredCache = null;
			set((s) => ({
				browser: { ...s.browser, allCards: cards, isLoading: false },
			}));
		},

		setSearchQuery: (query: string) => {
			set((s) => ({
				browser: { ...s.browser, searchQuery: query },
			}));
		},

		setStateFilter: (filter: BrowserStateFilter) => {
			set((s) => ({
				browser: { ...s.browser, stateFilter: filter },
			}));
		},

		setSortColumn: (column: BrowserSortColumn) => {
			set((s) => ({
				browser: { ...s.browser, sortColumn: column },
			}));
		},

		toggleSortDirection: () => {
			set((s) => ({
				browser: {
					...s.browser,
					sortDirection: s.browser.sortDirection === "asc" ? "desc" : "asc",
				},
			}));
		},

		cycleSortOnColumn: (column: BrowserSortColumn) => {
			const state = get().browser;
			if (state.sortColumn === column) {
				set((s) => ({
					browser: {
						...s.browser,
						sortDirection: s.browser.sortDirection === "asc" ? "desc" : "asc",
					},
				}));
			} else {
				set((s) => ({
					browser: { ...s.browser, sortColumn: column, sortDirection: "asc" },
				}));
			}
		},

		enterSelectionMode: selection.enterSelectionMode,
		exitSelectionMode: selection.exitSelectionMode,
		toggleCardSelection: selection.toggleSelection,
		isInSelectionMode: selection.isInSelectionMode,
		getSelectedCardIds: selection.getSelectedIds,

		selectAll: () => {
			const filtered = get().browser.getFilteredAndSortedCards();
			const ids = new Set(filtered.map((c) => c.id));
			set((s) => ({
				browser: {
					...s.browser,
					selectionMode: "selecting",
					selectedCardIds: ids,
				},
			}));
		},

		setPreviewCardId: (cardId: string | null) => {
			set((s) => ({
				browser: { ...s.browser, previewCardId: cardId },
			}));
		},

		getFilteredAndSortedCards: () => {
			const state = get().browser;
			const { allCards, searchQuery, stateFilter, sortColumn, sortDirection } =
				state;

			const cacheKey = `${allCards.length}:${searchQuery}:${stateFilter}:${sortColumn}:${sortDirection}`;
			if (filteredCache && filteredCacheKey === cacheKey) {
				return filteredCache;
			}

			let cards = allCards;

			if (searchQuery) {
				cards = cards.filter((c) => matchesSearch(c, searchQuery));
			}

			if (stateFilter !== "all") {
				cards = cards.filter((c) => matchesStateFilter(c, stateFilter));
			}

			filteredCache = [...cards].sort((a, b) =>
				compareCards(a, b, sortColumn, sortDirection),
			);
			filteredCacheKey = cacheKey;
			return filteredCache;
		},
	};

	return slice;
}
