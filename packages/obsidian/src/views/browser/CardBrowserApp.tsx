import type { ReadonlySignal, Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { AppNavBar } from "@true-recall/obsidian/components";
import { BrowserSidebar } from "@true-recall/obsidian/features/library/ui/browser/components/BrowserSidebar";
import { BrowserToolbar } from "@true-recall/obsidian/features/library/ui/browser/components/BrowserToolbar";
import { BulkActionsBar } from "@true-recall/obsidian/features/library/ui/browser/components/BulkActionsBar";
import { CardPreview } from "@true-recall/obsidian/features/library/ui/browser/components/CardPreview";
import { CardTable } from "@true-recall/obsidian/features/library/ui/browser/components/CardTable";
import { toggleListValue } from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-filters";
import { DEFAULT_VISIBLE_KEYS } from "@true-recall/obsidian/features/library/ui/browser/helpers/column-defs";
import { useBrowserActions } from "@true-recall/obsidian/features/library/ui/browser/hooks/useBrowserActions";
import { useBrowserSelection } from "@true-recall/obsidian/features/library/ui/browser/hooks/useBrowserSelection";
import { useCardBrowserQuery } from "@true-recall/obsidian/features/library/ui/browser/hooks/useCardBrowserQuery";
import { useKeyboardNav } from "@true-recall/obsidian/features/library/ui/browser/hooks/useKeyboardNav";

interface CardBrowserAppProps {
	filterSourceUid?: Signal<string | null>;
	filterOrphaned?: Signal<boolean>;
	isViewVisible: ReadonlySignal<boolean>;
}

/**
 * Composes the card browser: toolbar, bulk actions, sidebar, table and
 * preview. Query state, selection and card actions live in their own hooks
 * under `features/library/ui/browser/hooks`.
 */
export function CardBrowserApp({
	filterSourceUid,
	filterOrphaned,
	isViewVisible,
}: CardBrowserAppProps) {
	const query = useCardBrowserQuery({
		isViewVisible,
		filterSourceUid,
		filterOrphaned,
	});
	const selection = useBrowserSelection({
		queryService: query.queryService,
		filter: query.filter,
		result: query.result,
	});
	const actions = useBrowserActions({
		queryService: query.queryService,
		selection,
		result: query.result,
	});

	const sidebarVisible = useSignal(true);
	const visibleColumns = useSignal<string[]>(DEFAULT_VISIBLE_KEYS);
	const rootRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// A new query starts at the top of the list.
	useEffect(() => {
		scrollContainerRef.current?.scrollTo({ top: 0 });
	}, [query.queryResetKey]);

	const toggleColumn = useCallback(
		(key: string) => {
			visibleColumns.value = toggleListValue(visibleColumns.value, key);
		},
		[visibleColumns],
	);

	const toggleSidebar = useCallback(() => {
		sidebarVisible.value = !sidebarVisible.value;
	}, [sidebarVisible]);

	const focusSearch = useCallback(() => {
		rootRef.current
			?.querySelector<HTMLInputElement>(".ep-card-browser-search input")
			?.focus();
	}, []);

	const previewCardId = actions.previewCard?.id ?? null;

	useKeyboardNav({
		rootRef,
		cards: query.result.cards,
		selectedCount: selection.selectedIds.size,
		previewCardId,
		onSelect: selection.select,
		onPreview: actions.togglePreview,
		onClearSelection: selection.clear,
		onSelectAll: selection.selectAll,
		onFocusSearch: focusSearch,
	});

	return (
		<div ref={rootRef} class="ep-card-browser ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="browse" collapsible />
			<BrowserToolbar
				searchText={query.searchText}
				onSearchChange={query.setSearchText}
				stateFilters={query.stateFilters}
				onToggleStateFilter={query.toggleStateFilter}
				onRemoveStateFilter={query.removeStateFilter}
				sort={query.sort}
				totalCount={query.result.totalCount}
				showArchived={query.showArchived}
				onToggleShowArchived={query.toggleShowArchived}
				sidebarVisible={sidebarVisible.value}
				onToggleSidebar={toggleSidebar}
				visibleColumns={visibleColumns.value}
				onToggleColumn={toggleColumn}
				getSuggestions={query.getSuggestions}
			/>

			{selection.selectedIds.size > 0 ? (
				<BulkActionsBar
					selectedCount={selection.selectedIds.size}
					selectedIds={selection.selectedIds}
					onClearSelection={selection.clear}
					onSelectAll={selection.selectAll}
					totalCount={query.result.totalCount}
					onMove={actions.moveSelected}
				/>
			) : null}

			<div class="ep:flex ep:flex-1 ep:min-h-0">
				{sidebarVisible.value ? (
					<BrowserSidebar
						facetCounts={query.facetCounts}
						activeFilter={query.sidebarFilter}
						onFilterChange={query.updateSidebarFilter}
						orphanedCount={query.orphanedCardIds.length}
						onRemoveOrphanedCards={() => void actions.removeOrphaned()}
					/>
				) : null}

				<div class="ep:flex-1 ep:min-w-0 ep:flex ep:flex-col">
					<CardTable
						cards={query.result.cards}
						sort={query.sort}
						onSort={query.toggleSort}
						selectedIds={selection.selectedIds}
						onSelect={selection.select}
						onPreview={actions.togglePreview}
						previewCardId={previewCardId}
						visibleColumns={visibleColumns.value}
						scrollContainerRef={scrollContainerRef}
						hasMore={query.hasMore}
						onReachEnd={query.loadMore}
					/>
				</div>

				{actions.previewCard ? (
					<CardPreview
						card={actions.previewCard}
						onClose={actions.closePreview}
						onContentChange={(value, field) =>
							void actions.saveContent(value, field)
						}
						onMove={() => void actions.movePreviewCard()}
						onEdit={() => void actions.editPreviewCard()}
					/>
				) : null}
			</div>
		</div>
	);
}
