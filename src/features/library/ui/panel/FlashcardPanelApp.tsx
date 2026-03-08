import { streamingGeneration } from "@features/ai/services/streaming-state";
import {
	type ContentHandlers,
	PanelContent,
	PanelHeader,
} from "@features/library/ui/panel/components";
import {
	useCardActions,
	usePanelActions,
	usePanelStore,
	useScrollPreservation,
	useSelectionActions,
} from "@features/library/ui/panel/hooks";
import { useSignalEffect } from "@preact/signals";
import { Panel } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { Platform } from "obsidian";
import { useMemo, useState } from "preact/hooks";

export function FlashcardPanelApp({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	const plugin = usePlugin();
	const store = usePanelStore();
	const { contentRef, preserveScroll, captureScroll } = useScrollPreservation();

	const cardActions = useCardActions({
		currentFile: store.currentFile,
		flashcardInfo: store.flashcardInfo,
		cardsWithFsrs: store.cardsWithFsrs,
		panel: store.panel,
		preserveScroll,
		captureScroll,
	});

	const selectionActions = useSelectionActions({
		flashcardInfo: store.flashcardInfo,
		currentFile: store.currentFile,
		selectedCardIds: store.selectedCardIds,
		panel: store.panel,
		preserveScroll,
	});

	const panelActions = usePanelActions({
		currentFile: store.currentFile,
		flashcardInfo: store.flashcardInfo,
		cardsWithFsrs: store.cardsWithFsrs,
		panel: store.panel,
	});

	const contentHandlers: ContentHandlers = useMemo(
		() => ({
			onEditButton: cardActions.handleEditButton,
			onDeleteCard: cardActions.handleDeleteCard,
			onCopyCard: cardActions.handleCopyCard,
			onMoveCard: cardActions.handleMoveCard,
			onChangeType: cardActions.handleChangeType,
			onToggleReversed: cardActions.handleToggleReversed,
			onForgetCard: cardActions.handleForgetCard,
			onRewriteCard: cardActions.handleRewriteCard,
			onToggleExpand: cardActions.handleToggleExpand,
			onToggleSelect: selectionActions.handleToggleSelect,
			onEnterSelectionMode: selectionActions.handleEnterSelectionMode,
			onAdd: cardActions.handleAddFlashcard,
			onJumpToSource: panelActions.handleJumpToSource,
			onHoverSource: panelActions.handleHoverSource,
			onLeaveSource: panelActions.handleLeaveSource,
		}),
		[cardActions, selectionActions, panelActions],
	);

	// Track streaming cards not yet in DB for smooth counter updates
	const [streamingCompletedCount, setStreamingCompletedCount] = useState(0);
	const [streamingNotePath, setStreamingNotePath] = useState<string | null>(
		null,
	);
	useSignalEffect(() => {
		const s = streamingGeneration.value;
		setStreamingCompletedCount(s.completedCards.length);
		setStreamingNotePath(s.isGenerating ? s.notePath : null);
	});

	const streamingNewCount = useMemo(() => {
		if (!streamingNotePath || streamingNotePath !== store.currentFile?.path)
			return 0;
		const dbIds = new Set(store.cardsWithFsrs.map((c) => c.id));
		const streaming = streamingGeneration.peek();
		return streaming.completedCards.filter((c) => !dbIds.has(c.id)).length;
	}, [streamingCompletedCount, streamingNotePath, store.currentFile?.path, store.cardsWithFsrs]);

	const reviewedToday = plugin.sessionPersistence?.getReviewedToday();
	const dayStartHour = plugin.settings.dayStartHour;
	const showHeader = !Platform.isMobile;

	return (
		<Panel disableScroll>
			<div class="ep:flex ep:flex-col ep:gap-2 ep:h-full">
				{showHeader ? (
					<div class="ep:shrink-0">
						<PanelHeader
							flashcardInfo={store.flashcardInfo}
							cardsWithFsrs={store.cardsWithFsrs}
							hasUncollectedFlashcards={store.uncollectedCount > 0}
							uncollectedCount={store.uncollectedCount}
							selectionMode={store.selectionMode}
							selectedCount={store.selectedCardIds.size}
							totalCount={
							(store.flashcardInfo?.flashcards.length ?? 0) + streamingNewCount
						}
						streamingNewCount={streamingNewCount}
							searchQuery={store.searchQuery}
							isFollowingReview={store.isFollowingReview}
							reviewedToday={reviewedToday}
							dayStartHour={dayStartHour}
							onAdd={cardActions.handleAddFlashcard}
							onCollect={panelActions.handleCollect}
							onRefresh={() => onActions?.({ type: "refresh" })}
							onReview={panelActions.handleReview}
							onExitSelectionMode={selectionActions.handleExitSelectionMode}
							onSelectAll={selectionActions.handleSelectAll}
							onMoveSelected={selectionActions.handleMoveSelected}
							onChangeNoteType={selectionActions.handleChangeNoteType}
							onRewriteSelected={selectionActions.handleRewriteSelected}
							onForgetSelected={selectionActions.handleForgetSelected}
							onDeleteSelected={selectionActions.handleDeleteSelected}
							onSearchChange={panelActions.handleSearchChange}
							onExportCsv={panelActions.handleExportCsv}
							onCopyToClipboard={panelActions.handleCopyAllToClipboard}
							onForgetAll={selectionActions.handleForgetAll}
							onDeleteAll={selectionActions.handleDeleteAll}
							onOpenSourceNote={panelActions.handleOpenSourceNote}
							hasHighlights={store.hasHighlights}
							onGenerateFromHighlights={
								panelActions.handleGenerateFromHighlights
							}
							onBrowseDeck={panelActions.handleBrowseDeck}
						/>
					</div>
				) : null}

				<div ref={contentRef} class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
					<PanelContent
						flashcardInfo={store.flashcardInfo}
						currentFile={store.currentFile}
						status={store.status}
						selectionMode={store.selectionMode}
						selectedCardIds={store.selectedCardIds}
						expandedCardIds={store.expandedCardIds}
						cardsWithFsrs={store.cardsWithFsrs}
						searchQuery={store.searchQuery}
						handlers={contentHandlers}
						onGenerateFromNote={panelActions.handleGenerateFromNote}
						onGenerateFromHighlights={panelActions.handleGenerateFromHighlights}
						onCollect={panelActions.handleCollect}
						uncollectedCount={store.uncollectedCount}
						hasApiKey={
							!!(
								plugin.settings.openRouterApiKey ||
								plugin.settings.subscriptionKey
							)
						}
						hasHighlights={store.hasHighlights}
					/>
				</div>
			</div>
		</Panel>
	);
}

export type PanelAppActions = { type: "refresh" };
