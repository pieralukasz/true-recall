import { type Signal, useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";

import { DuplicateQuestionError } from "@true-recall/core/flashcard/data/card-repository.service";
import { parseSearchQuery } from "@true-recall/core/helpers/search-parser";
import { CardBrowserQueryService } from "@true-recall/core/services/browser/card-browser-query.service";
import type {
	FSRSFlashcardItem,
	TrueRecallSettings,
} from "@true-recall/core/types";

import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import { MoveCardCommand } from "@true-recall/obsidian/commands/commands/card-move.cmd";
import { AppNavBar } from "@true-recall/obsidian/components";
import { mutate, Q, useQuery } from "@true-recall/obsidian/data";
import { BrowserSidebar } from "@true-recall/obsidian/features/library/ui/browser/components/BrowserSidebar";
import { BrowserToolbar } from "@true-recall/obsidian/features/library/ui/browser/components/BrowserToolbar";
import { BulkActionsBar } from "@true-recall/obsidian/features/library/ui/browser/components/BulkActionsBar";
import { CardPreview } from "@true-recall/obsidian/features/library/ui/browser/components/CardPreview";
import { CardTable } from "@true-recall/obsidian/features/library/ui/browser/components/CardTable";
import { createBrowserSuggestionProvider } from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-suggestions";
import { DEFAULT_VISIBLE_KEYS } from "@true-recall/obsidian/features/library/ui/browser/helpers/column-defs";
import {
	BROWSER_PAGE_SIZE,
	getBrowserQueryResetKey,
} from "@true-recall/obsidian/features/library/ui/browser/helpers/infinite-scroll";
import { useKeyboardNav } from "@true-recall/obsidian/features/library/ui/browser/hooks/useKeyboardNav";
import {
	type BrowserCard,
	type BrowserResult,
	EMPTY_FILTER,
	type FilterState,
	type SortConfig,
	type StateFilterValue,
} from "@true-recall/obsidian/features/library/ui/browser/types";
import { notifyDuplicateError } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { MoveCardModal } from "@true-recall/obsidian/modals/shared/MoveCardModal";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

const PAGE_SIZE = BROWSER_PAGE_SIZE;

interface CardBrowserAppProps {
	filterSourceUid?: Signal<string | null>;
	filterOrphaned?: Signal<boolean>;
}

export function CardBrowserApp({
	filterSourceUid,
	filterOrphaned,
}: CardBrowserAppProps) {
	const plugin = usePlugin();
	const settingsSignal = useQuery<TrueRecallSettings>(Q.SETTINGS);
	const app = useApp();

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

	useEffect(() => {
		if (!filterOrphaned) return;
		if (!filterOrphaned.value) return;

		sidebarFilter.value = { ...EMPTY_FILTER, orphanedOnly: true };
		filterOrphaned.value = false;
	}, [filterOrphaned?.value]);

	const queryService = useMemo(
		() =>
			new CardBrowserQueryService(
				plugin.cardStore,
				plugin.frontmatterIndex,
				plugin.hierarchyService,
			),
		[plugin],
	);

	// Signal reads — subscribe component to reactive data changes
	const allCardsSignal = useQuery<Map<string, FSRSFlashcardItem>>(Q.ALL_META);
	const allCards = allCardsSignal.value;
	const _settings = settingsSignal.value;
	const searchTextVal = searchText.value;
	const stateFiltersVal = stateFilters.value;
	const sidebarFilterVal = sidebarFilter.value;
	const showArchivedVal = showArchived.value;
	const sortVal = sort.value;
	const loadedLimitVal = loadedLimit.value;

	const combinedFilter = useMemo((): FilterState => {
		const parsed = parseSearchQuery(searchTextVal);
		return {
			...parsed,
			states: [
				...parsed.states,
				...stateFiltersVal,
				...sidebarFilterVal.states,
			],
			sourceUids: [...parsed.sourceUids, ...sidebarFilterVal.sourceUids],
			cardTypes: [...parsed.cardTypes, ...sidebarFilterVal.cardTypes],
			createdVia: [...parsed.createdVia, ...sidebarFilterVal.createdVia],
			negatedStates: [
				...parsed.negatedStates,
				...sidebarFilterVal.negatedStates,
			],
			showArchived: showArchivedVal,
			orphanedOnly: parsed.orphanedOnly || sidebarFilterVal.orphanedOnly,
		};
	}, [searchTextVal, stateFiltersVal, sidebarFilterVal, showArchivedVal]);

	const result = useMemo((): BrowserResult => {
		return queryService.query(combinedFilter, sortVal, loadedLimitVal, 0);
	}, [
		allCards,
		_settings,
		queryService,
		combinedFilter,
		sortVal,
		loadedLimitVal,
	]);

	const queryResetKey = useMemo(
		() => getBrowserQueryResetKey(combinedFilter, sortVal),
		[combinedFilter, sortVal],
	);

	const facetCounts = useMemo(
		() => queryService.getFacetCounts(showArchivedVal),
		[allCards, queryService, showArchivedVal],
	);

	const orphanedCardIds = useMemo(
		() => queryService.getOrphanedCardIds(),
		[allCards, queryService],
	);

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

	const handleRemoveOrphanedCards = useCallback(async () => {
		const orphanedIds = queryService.getOrphanedCardIds();
		if (orphanedIds.length === 0) return;

		const cardWord = orphanedIds.length === 1 ? "card" : "cards";
		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);
		const confirmed = await confirm(app, {
			message: `Remove ${orphanedIds.length} orphaned ${cardWord}?`,
		});
		if (!confirmed) return;

		const cmd = new DeleteCardCommand(orphanedIds);
		await plugin.commandService?.execute(cmd);
		notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
			void plugin.commandService?.undo();
		});

		const deletedSet = new Set(orphanedIds);
		selectedIds.value = new Set(
			[...selectedIds.value].filter((id) => !deletedSet.has(id)),
		);
		if (previewCard.value && deletedSet.has(previewCard.value.id)) {
			previewCard.value = null;
		}
	}, [app, plugin, queryService]);

	const handleMoveCard = useCallback(async () => {
		const card = previewCard.value;
		if (!card) return;
		const modal = new MoveCardModal(app, {
			cardCount: 1,
			sourceNoteName: card.sourceNoteName ?? undefined,
			cardQuestion: card.question,
			cardAnswer: card.answer,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;
		const cmd = new MoveCardCommand(card.id, result.targetNotePath);
		await plugin.commandService?.execute(cmd);
		notify().cardsMoved(1, result.targetNotePath);
	}, [app, plugin, previewCard]);

	const handleBulkMove = useCallback(async () => {
		const ids = Array.from(selectedIds.value);
		if (ids.length === 0) return;
		const modal = new MoveCardModal(app, { cardCount: ids.length });
		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;
		for (const id of ids) {
			await plugin.flashcardManager.moveCard(id, result.targetNotePath);
		}
		mutate("cards:bulk", () => {});
		notify().cardsMoved(ids.length, result.targetNotePath);
		handleClearSelection();
	}, [app, plugin, selectedIds, handleClearSelection]);

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
			<AppNavBar activeItem="browse" collapsible />
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
					onMove={handleBulkMove}
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
						onMove={handleMoveCard}
					/>
				)}
			</div>
		</div>
	);
}
