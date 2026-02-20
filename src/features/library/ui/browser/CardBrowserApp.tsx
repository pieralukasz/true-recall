import {
	BrowserToolbar,
	CardDetailPanel,
	COLUMNS,
	SelectionBar,
	VirtualTable,
} from "@features/library/ui/browser/components";
import { useBrowserActions } from "@features/library/ui/browser/hooks/useBrowserActions";
import { effect } from "@preact/signals";
import { notify } from "@shared/services/notification.service";
import { dataVersion, track } from "@shared/services/signals";
import type {
	BrowserApi,
	BrowserSortColumn,
	BrowserStateFilter,
	SelectionMode,
} from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import { LoadingSpinner } from "@shared/ui/components";
import { useApp, usePlugin } from "@shared/ui/preact";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

// ── Hooks ──────────────────────────────────────────────────────

function useBrowser(): BrowserApi {
	const store = usePlugin().store;
	if (!store) throw new Error("Store not initialized");
	return store.getState().browser;
}

function useBrowserState() {
	const plugin = usePlugin();
	const [state, setState] = useState(() => {
		const b = plugin.store?.getState().browser;
		if (!b) {
			return {
				isLoading: true,
				allCards: [] as FSRSFlashcardItem[],
				searchQuery: "",
				stateFilter: "all" as BrowserStateFilter,
				sortColumn: "question" as BrowserSortColumn,
				sortDirection: "asc" as "asc" | "desc",
				selectionMode: "idle" as SelectionMode,
				selectedCardIds: new Set<string>(),
				previewCardId: null as string | null,
				filteredCards: [] as FSRSFlashcardItem[],
			};
		}
		return {
			isLoading: b.isLoading,
			allCards: b.allCards,
			searchQuery: b.searchQuery,
			stateFilter: b.stateFilter as BrowserStateFilter,
			sortColumn: b.sortColumn as BrowserSortColumn,
			sortDirection: b.sortDirection as "asc" | "desc",
			selectionMode: b.selectionMode as SelectionMode,
			selectedCardIds: b.selectedCardIds,
			previewCardId: b.previewCardId,
			filteredCards: b.getFilteredAndSortedCards(),
		};
	});

	useEffect(() => {
		if (!plugin.store) return;
		const unsub = plugin.store.subscribe(
			(s) => s.browser,
			() => {
				const b = plugin.store?.getState().browser;
				if (!b) return;
				setState({
					isLoading: b.isLoading,
					allCards: b.allCards,
					searchQuery: b.searchQuery,
					stateFilter: b.stateFilter as BrowserStateFilter,
					sortColumn: b.sortColumn as BrowserSortColumn,
					sortDirection: b.sortDirection as "asc" | "desc",
					selectionMode: b.selectionMode as SelectionMode,
					selectedCardIds: b.selectedCardIds,
					previewCardId: b.previewCardId,
					filteredCards: b.getFilteredAndSortedCards(),
				});
			},
		);
		return unsub;
	}, [plugin]);

	return state;
}

function useLoadData() {
	const plugin = usePlugin();

	return useCallback(() => {
		const browser = plugin.store?.getState().browser;
		if (!browser) return;
		browser.setLoading(true);

		try {
			const cards = plugin.flashcardManager.getAllFSRSCards();
			browser.setCards(cards);
		} catch (error) {
			console.error("[CardBrowserView] Error loading data:", error);
			notify().error("Failed to load card browser data");
			browser.setLoading(false);
		}
	}, [plugin]);
}

// ── Root Component ─────────────────────────────────────────────

export function CardBrowserApp() {
	const state = useBrowserState();
	const browser = useBrowser();
	const loadData = useLoadData();
	const app = useApp();
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const actions = useBrowserActions(browser);

	useEffect(() => {
		loadData();

		let isFirstRun = true;
		const dispose = effect(() => {
			track(dataVersion);
			if (isFirstRun) {
				isFirstRun = false;
				return;
			}
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = setTimeout(() => {
				loadData();
			}, 500);
		});
		return () => {
			dispose();
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
		};
	}, [loadData]);

	useEffect(() => {
		return () => browser.reset();
	}, [browser]);

	const previewCard = useMemo(() => {
		if (!state.previewCardId) return null;
		return (
			state.filteredCards.find((c) => c.id === state.previewCardId) ??
			state.allCards.find((c) => c.id === state.previewCardId) ??
			null
		);
	}, [state.previewCardId, state.filteredCards, state.allCards]);

	const handleRowClick = useCallback(
		(card: FSRSFlashcardItem) => {
			const current = browser.previewCardId;
			browser.setPreviewCardId(current === card.id ? null : card.id);
		},
		[browser],
	);

	const handleRowSelect = useCallback(
		(cardId: string) => {
			if (browser.selectionMode !== "selecting") {
				browser.enterSelectionMode(cardId);
			} else {
				browser.toggleCardSelection(cardId);
			}
		},
		[browser],
	);

	const handleSelectAll = useCallback(() => {
		const filtered = browser.getFilteredAndSortedCards();
		const allSelected =
			filtered.length > 0 &&
			filtered.every((c) => browser.selectedCardIds.has(c.id));

		if (allSelected) {
			browser.exitSelectionMode();
		} else {
			browser.selectAll();
		}
	}, [browser]);

	if (state.isLoading) {
		return (
			<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0">
				<LoadingSpinner />
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-hidden ep:min-h-0">
			<div class="ep:shrink-0">
				<BrowserToolbar
					searchQuery={state.searchQuery}
					stateFilter={state.stateFilter}
					totalCount={state.allCards.length}
					filteredCount={state.filteredCards.length}
					onSearchChange={(q) => browser.setSearchQuery(q)}
					onStateFilterChange={(f) => browser.setStateFilter(f)}
					onRefresh={loadData}
				/>
			</div>
			<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0 ep:overflow-hidden">
				<VirtualTable
					data={state.filteredCards}
					columns={COLUMNS}
					selectionMode={state.selectionMode}
					selectedIds={state.selectedCardIds}
					activeItemId={state.previewCardId}
					sortColumn={state.sortColumn}
					sortDirection={state.sortDirection}
					onRowClick={handleRowClick}
					onRowSelect={handleRowSelect}
					onSortChange={(col) =>
						browser.cycleSortOnColumn(col as BrowserSortColumn)
					}
					onSelectAll={handleSelectAll}
				/>
			</div>
			{previewCard && (
				<div class="ep:shrink-0">
					<CardDetailPanel
						card={previewCard}
						onClose={() => browser.setPreviewCardId(null)}
						onOpenSource={(path) =>
							void app.workspace.openLinkText(path, "", false)
						}
						onSuspend={actions.handleSingleSuspend}
						onUnsuspend={actions.handleSingleUnsuspend}
						onDelete={actions.handleSingleDelete}
						onReset={actions.handleSingleReset}
					/>
				</div>
			)}
			{state.selectionMode === "selecting" && (
				<div class="ep:shrink-0">
					<SelectionBar
						selectedCount={state.selectedCardIds.size}
						onCancel={() => browser.exitSelectionMode()}
						onSuspend={actions.handleBulkSuspend}
						onUnsuspend={actions.handleBulkUnsuspend}
						onReset={actions.handleBulkReset}
						onDelete={actions.handleBulkDelete}
					/>
				</div>
			)}
		</div>
	);
}
