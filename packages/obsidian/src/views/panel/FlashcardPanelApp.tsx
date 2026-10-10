import { useEffect, useRef, useState } from "preact/hooks";

import { Panel } from "@true-recall/obsidian/components";
import {
	NormalHeader,
	PanelAiStrip,
	PanelContent,
	SelectionActionsBar,
	SelectionToolbar,
} from "@true-recall/obsidian/features/library/ui/panel/components";
import { MobileNoteCardsHeader } from "@true-recall/obsidian/features/library/ui/panel/components/MobileNoteCardsHeader";
import { PanelCardDetail } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCardDetail";
import { QuickAddPanel } from "@true-recall/obsidian/features/library/ui/panel/components/QuickAddPanel";
import { PanelScrollProvider } from "@true-recall/obsidian/features/library/ui/panel/hooks";
import { useFlashcardPanel } from "@true-recall/obsidian/features/library/ui/panel/hooks/useFlashcardPanel";
import { isMobile } from "@true-recall/obsidian/utils/platform";

export function FlashcardPanelApp({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	return (
		<PanelScrollProvider>
			<FlashcardPanelContent onActions={onActions} />
		</PanelScrollProvider>
	);
}

function FlashcardPanelContent({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	const panel = useFlashcardPanel();
	const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
	const [quickAddSourceUid, setQuickAddSourceUid] = useState<
		string | undefined
	>();
	const openQuickAdd = () => {
		if (isQuickAddOpen) return;
		setQuickAddSourceUid(panel.store.flashcardInfo?.sourceUid);
		setIsQuickAddOpen(true);
	};

	return (
		<Panel disableScroll>
			<div
				ref={panel.panelRootRef}
				class="tr-flashcard-panel ep:flex ep:h-full ep:min-w-0 ep:flex-col ep:overflow-hidden"
			>
				{isQuickAddOpen ? (
					<QuickAddPanel
						sourceUid={quickAddSourceUid}
						onClose={() => setIsQuickAddOpen(false)}
					/>
				) : null}
				{panel.openCard && !panel.isSelecting ? (
					<PanelCardDetail
						card={panel.openCard}
						fsrsCard={panel.fsrsMap.get(panel.openCard.id)}
						sourcePath={panel.store.currentFile?.path ?? ""}
						position={Math.max(0, panel.openPosition) + 1}
						total={panel.visibleCards.length}
						dayStartHour={panel.dayStartHour}
						onBack={panel.closeCard}
						onPrevious={() => panel.navigateCard(-1)}
						onNext={() => panel.navigateCard(1)}
						actions={panel.actions}
					/>
				) : (
					<PanelList
						panel={panel}
						onRefresh={() => onActions?.({ type: "refresh" })}
						quickAddOpen={isQuickAddOpen}
						onOpenQuickAdd={openQuickAdd}
					/>
				)}
			</div>
		</Panel>
	);
}

function PanelList({
	panel,
	onRefresh,
	quickAddOpen,
	onOpenQuickAdd,
}: {
	panel: ReturnType<typeof useFlashcardPanel>;
	onRefresh: () => void;
	quickAddOpen: boolean;
	onOpenQuickAdd: () => void;
}) {
	const headerRef = useRef<HTMLDivElement>(null);
	const lockedHeight = useHeaderHeightLock(headerRef, panel.isSelecting);
	return (
		<>
			<div
				ref={headerRef}
				class="tr-panel-list-header ep:flex ep:shrink-0 ep:flex-col"
				style={
					panel.isSelecting && lockedHeight
						? { minHeight: `${lockedHeight}px` }
						: undefined
				}
			>
				{panel.isSelecting ? (
					<SelectionToolbar
						visibleCardIds={panel.visibleCardIds}
						allCardIds={panel.allCardIds}
					/>
				) : isMobile() ? (
					<MobileNoteCardsHeader
						noteName={panel.store.currentFile?.basename ?? null}
						totalCount={panel.allFlashcards.length}
						visibleCount={panel.visibleCardIds.length}
						dueCount={panel.dueCount}
						statusFilter={panel.statusFilter}
						sort={panel.sort}
						onStatusFilterChange={panel.setStatusFilter}
						onSortChange={panel.setSort}
						onEnterSelection={panel.enterSelection}
						onSearchInput={panel.handleSearchInput}
						onShowShortcuts={panel.showShortcuts}
						onRefresh={onRefresh}
						quickAddOpen={quickAddOpen}
						onOpenQuickAdd={onOpenQuickAdd}
					/>
				) : (
					<NormalHeader
						totalCount={panel.allFlashcards.length}
						visibleCount={panel.visibleCardIds.length}
						dueCount={panel.dueCount}
						statusFilter={panel.statusFilter}
						sort={panel.sort}
						onStatusFilterChange={panel.setStatusFilter}
						onSortChange={panel.setSort}
						onEnterSelection={panel.enterSelection}
						onSearchInput={panel.handleSearchInput}
						onShowShortcuts={panel.showShortcuts}
						onRefresh={onRefresh}
						quickAddOpen={quickAddOpen}
						onOpenQuickAdd={onOpenQuickAdd}
					/>
				)}

				{!panel.isSelecting ? <PanelAiStrip /> : null}
			</div>

			<div
				ref={panel.contentRef}
				class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto ep:overscroll-contain"
			>
				<PanelContent
					currentFile={panel.store.currentFile}
					activeViewContext={panel.store.activeViewContext}
					hasFlashcards={panel.allFlashcards.length > 0}
					items={panel.visibleItems}
					fsrsMap={panel.fsrsMap}
					selectedCardIds={panel.store.selectedCardIds}
					isSelectionMode={panel.isSelecting}
					searchQuery={panel.debouncedSearch}
					dayStartHour={panel.dayStartHour}
					isStreamingForFile={panel.isStreamingForFile}
					actions={panel.actions}
					onResetList={panel.resetList}
				/>
			</div>

			{panel.isSelecting ? <SelectionActionsBar /> : null}
		</>
	);
}

export type PanelAppActions = { type: "refresh" };

/**
 * The list header is taller than the selection toolbar. Keep its last height while
 * selecting, so the cards do not jump under the pointer when a drag turns selection on.
 */
function useHeaderHeightLock(
	ref: { current: HTMLDivElement | null },
	isSelecting: boolean,
): number | null {
	const [height, setHeight] = useState<number | null>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el || isSelecting) return;
		const measure = () => setHeight(el.getBoundingClientRect().height);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref, isSelecting]);
	return height;
}
