import { Panel } from "@true-recall/obsidian/components";
import {
	NormalHeader,
	PanelAiStrip,
	PanelContent,
	SelectionActionsBar,
	SelectionToolbar,
} from "@true-recall/obsidian/features/library/ui/panel/components";
import { MobileNoteCardsHeader } from "@true-recall/obsidian/features/library/ui/panel/components/MobileNoteCardsHeader";
import { isMobile } from "@true-recall/obsidian/utils/platform";
import { PanelCardDetail } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCardDetail";
import { PanelScrollProvider } from "@true-recall/obsidian/features/library/ui/panel/hooks";
import { useFlashcardPanel } from "@true-recall/obsidian/features/library/ui/panel/hooks/useFlashcardPanel";

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

	return (
		<Panel disableScroll>
			<div
				ref={panel.panelRootRef}
				class="tr-flashcard-panel ep:flex ep:h-full ep:min-w-0 ep:flex-col ep:overflow-hidden"
			>
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
					/>
				)}
			</div>
		</Panel>
	);
}

function PanelList({
	panel,
	onRefresh,
}: {
	panel: ReturnType<typeof useFlashcardPanel>;
	onRefresh: () => void;
}) {
	return (
		<>
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
				/>
			)}

			{!panel.isSelecting ? <PanelAiStrip /> : null}

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
