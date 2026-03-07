import { CardBrowserQueryService } from "@features/library/services/card-browser-query.service";
import { notifyDuplicateError } from "@features/library/ui/panel/utils/panel-helpers";
import { DuplicateQuestionError } from "@features/study/services/flashcard/card-repository.service";
import { type Signal, useComputed, useSignal } from "@preact/signals";
import { notify } from "@shared/services/notification.service";
import { cards, pluginSettings } from "@shared/services/reactive-card-store";
import { notifyCardChange } from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { BrowserSidebar } from "./components/BrowserSidebar";
import { BrowserToolbar } from "./components/BrowserToolbar";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { CardPreview } from "./components/CardPreview";
import { CardTable } from "./components/CardTable";
import { createBrowserSuggestionProvider } from "./helpers/browser-suggestions";
import { DEFAULT_VISIBLE_KEYS } from "./helpers/column-defs";
import {
	BROWSER_PAGE_SIZE,
	getBrowserQueryResetKey,
} from "./helpers/infinite-scroll";
import { parseSearchQuery } from "./helpers/search-parser";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import {
	type BrowserCard,
	type BrowserResult,
	EMPTY_FILTER,
	type FilterState,
	type SortConfig,
	type StateFilterValue,
} from "./types";

const PAGE_SIZE = BROWSER_PAGE_SIZE;

interface CardBrowserAppProps {
	filterSourceUid?: Signal<string | null>;
}

export function CardBrowserApp({ filterSourceUid }: CardBrowserAppProps) {
	const plugin = usePlugin();

	const searchText = useSignal("");
	const stateFilters = useSignal<StateFilterValue[]>([]);
	const sort = useSignal<SortConfig>({ column: "due", direction: "asc" });
	const selectedIds = useSignal<Set<string>>(new Set());
	const previewCard = useSignal<BrowserCard | null>(null);
	const sidebarVisible = useSignal(true);
	const showArchived = useSignal(false);
	const visibleColumns = useSignal<string[]>(DEFAULT_VISIBLE_KEYS);
	const sidebarFilter = useSignal<FilterState>(EMPTY_FILTER);
	const loadedLimit = useSignal(PAGE_SIZE);

	const scrollContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!filterSourceUid) return;
		const uid = filterSourceUid.value;
		if (!uid) return;

		sidebarFilter.value = { ...EMPTY_FILTER, sourceUids: [uid] };
		filterSourceUid.value = null;
	}, [filterSourceUid?.value]);

	const queryService = useMemo(
		() =>
			new CardBrowserQueryService(
				plugin.cardStore,
				plugin.frontmatterIndex,
				plugin.hierarchyService,
			),
		[plugin],
	);

	const combinedFilter = useComputed((): FilterState => {
		const parsed = parseSearchQuery(searchText.value);
		return {
			...parsed,
			states: [
				...parsed.states,
				...stateFilters.value,
				...sidebarFilter.value.states,
			],
			sourceUids: [...parsed.sourceUids, ...sidebarFilter.value.sourceUids],
			cardTypes: [...parsed.cardTypes, ...sidebarFilter.value.cardTypes],
			createdVia: [...parsed.createdVia, ...sidebarFilter.value.createdVia],
			negatedStates: [
				...parsed.negatedStates,
				...sidebarFilter.value.negatedStates,
			],
			showArchived: showArchived.value,
		};
	});

	const result = useComputed((): BrowserResult => {
		cards.value;
		pluginSettings.value;
		return queryService.query(
			combinedFilter.value,
			sort.value,
			loadedLimit.value,
			0,
		);
	}).value;

	const queryResetKey = useComputed(() =>
		getBrowserQueryResetKey(combinedFilter.value, sort.value),
	).value;

	const facetCounts = useComputed(() => {
		cards.value;
		return queryService.getFacetCounts(showArchived.value);
	}).value;

	const orphanedCardIds = useComputed(() => {
		cards.value;
		return queryService.getOrphanedCardIds();
	}).value;

	const getSuggestions = useMemo(() => {
		const presetNames = plugin.presetService.getPresets().map((p) => p.name);
		const projectNames = plugin.hierarchyService
			.buildHierarchy()
			.map((n) => n.name)
			.sort();
		return createBrowserSuggestionProvider({
			sourceNotes: facetCounts.sourceNotes,
			presetNames,
			projectNames,
		});
	}, [plugin, facetCounts.sourceNotes]);

	const handleSort = useCallback((column: string) => {
		sort.value =
			sort.value.column === column
				? {
						column,
						direction: sort.value.direction === "asc" ? "desc" : "asc",
					}
				: { column, direction: "asc" };
	}, []);

	const handleSelect = useCallback(
		(
			cardId: string,
			event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
		) => {
			const next = new Set(selectedIds.value);
			if (event?.ctrlKey || event?.metaKey) {
				if (next.has(cardId)) next.delete(cardId);
				else next.add(cardId);
			} else if (event?.shiftKey && result.cards.length > 0) {
				// Range select from last selected to current
				const lastSelected = Array.from(selectedIds.value).pop();
				if (lastSelected) {
					const lastIdx = result.cards.findIndex((c) => c.id === lastSelected);
					const currIdx = result.cards.findIndex((c) => c.id === cardId);
					if (lastIdx >= 0 && currIdx >= 0) {
						const [from, to] =
							lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
						for (let i = from; i <= to; i++) {
							const c = result.cards[i];
							if (c) next.add(c.id);
						}
					}
				}
			} else {
				if (next.has(cardId) && next.size === 1) {
					next.clear();
				} else {
					next.clear();
					next.add(cardId);
				}
			}
			selectedIds.value = next;
		},
		[result.cards],
	);

	const handlePreview = useCallback((card: BrowserCard) => {
		previewCard.value = previewCard.value?.id === card.id ? null : card;
	}, []);

	const handleContentChange = useCallback(
		(value: string, field: "question" | "answer") => {
			const card = previewCard.value;
			if (!card) return;
			if (card.cardType === "image-occlusion") {
				notify().warning(
					"Image occlusion cards are edited in the image occlusion editor.",
				);
				return;
			}

			const newQuestion = field === "question" ? value : card.question;
			const newAnswer = field === "answer" ? value : card.answer;

			try {
				plugin.flashcardManager.updateCardContent(
					card.id,
					newQuestion,
					newAnswer,
				);
				previewCard.value = {
					...card,
					question: newQuestion,
					answer: newAnswer,
				};
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					notifyDuplicateError(plugin, error, newQuestion);
				} else {
					notify().operationFailed("save card", error);
				}
			}
		},
		[plugin],
	);

	const handleSelectAll = useCallback(() => {
		if (selectedIds.value.size === result.cards.length) {
			selectedIds.value = new Set();
		} else {
			selectedIds.value = new Set(result.cards.map((c) => c.id));
		}
	}, [result.cards]);

	const handleClearSelection = useCallback(() => {
		selectedIds.value = new Set();
	}, []);

	const handleToggleStateFilter = useCallback((state: StateFilterValue) => {
		const current = stateFilters.value;
		stateFilters.value = current.includes(state)
			? current.filter((s) => s !== state)
			: [...current, state];
	}, []);

	const handleRemoveStateFilter = useCallback((state: StateFilterValue) => {
		stateFilters.value = stateFilters.value.filter((s) => s !== state);
	}, []);

	const handleSidebarFilter = useCallback((partial: Partial<FilterState>) => {
		sidebarFilter.value = { ...sidebarFilter.value, ...partial } as FilterState;
	}, []);

	const handleToggleColumn = useCallback((key: string) => {
		const current = visibleColumns.value;
		visibleColumns.value = current.includes(key)
			? current.filter((k) => k !== key)
			: [...current, key];
	}, []);

	const handleToggleShowArchived = useCallback(() => {
		showArchived.value = !showArchived.value;
	}, []);

	const hasMore = result.cards.length < result.totalCount;

	const loadMore = useCallback(() => {
		if (!hasMore) return;
		loadedLimit.value += PAGE_SIZE;
	}, [hasMore]);

	const handleRemoveOrphanedCards = useCallback(() => {
		const orphanedIds = queryService.getOrphanedCardIds();
		if (orphanedIds.length === 0) return;

		const cardWord = orphanedIds.length === 1 ? "card" : "cards";
		const confirmed = confirm(
			`Remove ${orphanedIds.length} orphaned ${cardWord}? This cannot be undone.`,
		);
		if (!confirmed) return;

		const deletedCount = plugin.cardStore.cards.bulkSoftDelete(orphanedIds);
		notifyCardChange({
			type: "bulk",
			cardIds: orphanedIds,
			action: "delete",
		});
		notify().cardsDeleted(deletedCount);

		const deletedSet = new Set(orphanedIds);
		selectedIds.value = new Set(
			[...selectedIds.value].filter((id) => !deletedSet.has(id)),
		);
		if (previewCard.value && deletedSet.has(previewCard.value.id)) {
			previewCard.value = null;
		}
	}, [plugin, queryService]);

	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		loadedLimit.value = PAGE_SIZE;
		scrollContainerRef.current?.scrollTo({ top: 0 });
	}, [queryResetKey]);

	useKeyboardNav({
		cards: result.cards,
		selectedIds: selectedIds.value,
		previewCardId: previewCard.value?.id ?? null,
		onSelect: handleSelect,
		onPreview: handlePreview,
		onClearSelection: handleClearSelection,
		onSelectAll: handleSelectAll,
		onFocusSearch: () => searchInputRef.current?.focus(),
	});

	return (
		<div class="ep-card-browser ep:flex ep:flex-col ep:h-full">
			<BrowserToolbar
				searchText={searchText.value}
				onSearchChange={(v) => {
					searchText.value = v;
				}}
				stateFilters={stateFilters.value}
				onToggleStateFilter={handleToggleStateFilter}
				onRemoveStateFilter={handleRemoveStateFilter}
				sort={sort.value}
				totalCount={result.totalCount}
				showArchived={showArchived.value}
				onToggleShowArchived={handleToggleShowArchived}
				sidebarVisible={sidebarVisible.value}
				onToggleSidebar={() => {
					sidebarVisible.value = !sidebarVisible.value;
				}}
				visibleColumns={visibleColumns.value}
				onToggleColumn={handleToggleColumn}
				getSuggestions={getSuggestions}
			/>

			{selectedIds.value.size > 0 && (
				<BulkActionsBar
					selectedCount={selectedIds.value.size}
					selectedIds={selectedIds.value}
					onClearSelection={handleClearSelection}
					onSelectAll={handleSelectAll}
					totalCount={result.totalCount}
				/>
			)}

			<div class="ep:flex ep:flex-1 ep:min-h-0">
				{sidebarVisible.value && (
					<BrowserSidebar
						facetCounts={facetCounts}
						activeFilter={sidebarFilter.value}
						onFilterChange={handleSidebarFilter}
						orphanedCount={orphanedCardIds.length}
						onRemoveOrphanedCards={handleRemoveOrphanedCards}
					/>
				)}

				<div class="ep:flex-1 ep:min-w-0 ep:flex ep:flex-col">
					<CardTable
						cards={result.cards}
						sort={sort.value}
						onSort={handleSort}
						selectedIds={selectedIds.value}
						onSelect={handleSelect}
						onPreview={handlePreview}
						previewCardId={previewCard.value?.id ?? null}
						visibleColumns={visibleColumns.value}
						scrollContainerRef={scrollContainerRef}
						hasMore={hasMore}
						onReachEnd={loadMore}
					/>
				</div>

				{previewCard.value && (
					<CardPreview
						card={previewCard.value}
						onClose={() => {
							previewCard.value = null;
						}}
						onContentChange={handleContentChange}
					/>
				)}
			</div>
		</div>
	);
}
