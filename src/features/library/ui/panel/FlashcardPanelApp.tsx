import {
	type ContentHandlers,
	NormalHeader,
	PanelContent,
	SelectionToolbar,
} from "@features/library/ui/panel/components";
import {
	useCardActions,
	usePanelActions,
	usePanelStore,
	useScrollPreservation,
	useSelectionActions,
} from "@features/library/ui/panel/hooks";
import { useStreamingNewCount } from "@features/library/ui/panel/hooks/useStreamingNewCount";
import { Panel } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { Platform } from "obsidian";
import { useMemo } from "preact/hooks";

export function FlashcardPanelApp({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	const plugin = usePlugin();
	const store = usePanelStore();
	const { contentRef, preserveScroll, captureScroll } = useScrollPreservation();

	const cardActions = useCardActions({ preserveScroll, captureScroll });
	const selectionActions = useSelectionActions({ preserveScroll });
	const panelActions = usePanelActions();

	const contentHandlers: ContentHandlers = useMemo(
		() => ({
			onEditButton: cardActions.handleEditButton,
			onDeleteCard: cardActions.handleDeleteCard,
			onCopyCard: cardActions.handleCopyCard,
			onMoveCard: cardActions.handleMoveCard,
			onChangeType: cardActions.handleChangeType,
			onToggleReversed: cardActions.handleToggleReversed,
			onForgetCard: cardActions.handleForgetCard,
			onSuspendCard: cardActions.handleSuspendCard,
			onUnsuspendCard: cardActions.handleUnsuspendCard,
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

	const streamingNewCount = useStreamingNewCount(
		store.cardsWithFsrs,
		store.currentFile?.path,
	);

	const showHeader = !Platform.isMobile;

	return (
		<Panel disableScroll>
			<div class="ep:flex ep:flex-col ep:gap-2 ep:h-full">
				{showHeader && (
					<div class="ep:shrink-0">
						{store.selectionMode === "selecting" ? (
							<SelectionToolbar preserveScroll={preserveScroll} />
						) : (
							<NormalHeader
								streamingNewCount={streamingNewCount}
								onRefresh={() => onActions?.({ type: "refresh" })}
								preserveScroll={preserveScroll}
								captureScroll={captureScroll}
							/>
						)}
					</div>
				)}

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
						hasApiKey={!!plugin.settings.openRouterApiKey}
						hasHighlights={store.hasHighlights}
					/>
				</div>
				{store.currentFile && (
					<div
						class="ep:shrink-0 ep:text-ui-smaller ep:text-obs-faint ep:truncate ep:text-center ep:px-2"
						title={store.currentFile.basename}
					>
						{store.currentFile.basename}
					</div>
				)}
			</div>
		</Panel>
	);
}

export type PanelAppActions = { type: "refresh" };
