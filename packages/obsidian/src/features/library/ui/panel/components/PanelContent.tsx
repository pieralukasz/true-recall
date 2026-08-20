import { useVirtualizer } from "@tanstack/react-virtual";
import type { TFile } from "obsidian";
import { useCallback } from "preact/hooks";

import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import {
	EmptyState,
	EmptyStateMessages,
} from "@true-recall/obsidian/components";
import { PanelCard } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCard";
import { PanelEmptyState } from "@true-recall/obsidian/features/library/ui/panel/components/PanelEmptyState";
import { PanelIOGroup } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIOGroup";
import { StreamingSection } from "@true-recall/obsidian/features/library/ui/panel/components/StreamingSection";
import type { PanelItem } from "@true-recall/obsidian/features/library/ui/panel/group-cards";
import { usePanelScroll } from "@true-recall/obsidian/features/library/ui/panel/hooks/PanelScrollContext";
import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import { getPanelItemRepresentative } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";

interface PanelContentProps {
	currentFile: TFile | null;
	activeViewContext: string | null;
	hasFlashcards: boolean;
	items: PanelItem[];
	fsrsMap: Map<string, FSRSFlashcardItem>;
	selectedCardIds: Set<string>;
	isSelectionMode: boolean;
	searchQuery: string;
	dayStartHour: number;
	isStreamingForFile: boolean;
	actions: PanelCardActionHandlers;
	onResetList: () => void;
}

export function PanelContent({
	currentFile,
	activeViewContext,
	hasFlashcards,
	items,
	fsrsMap,
	selectedCardIds,
	isSelectionMode,
	searchQuery,
	dayStartHour,
	isStreamingForFile,
	actions,
	onResetList,
}: PanelContentProps) {
	const { scrollRef } = usePanelScroll();
	const getItemKey = useCallback(
		(index: number) => getPanelItemRepresentative(items[index] as PanelItem).id,
		[items],
	);
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		getItemKey,
		estimateSize: () => 44,
		overscan: 6,
	});

	if (!currentFile) {
		return activeViewContext ? (
			<EmptyState
				message={`${activeViewContext} is active. Open a note to see its flashcards.`}
			/>
		) : (
			<EmptyState message={EmptyStateMessages.NO_FILE} />
		);
	}

	if (currentFile.extension !== "md") {
		return <EmptyState message={EmptyStateMessages.NOT_MARKDOWN} />;
	}

	if (!hasFlashcards && !isStreamingForFile) return <PanelEmptyState />;

	if (items.length === 0 && !isStreamingForFile) {
		return (
			<div class="ep:flex ep:h-full ep:flex-col ep:items-center ep:justify-center ep:gap-3 ep:px-5 ep:text-center">
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					No Matching Cards
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					Clear the search or filters to show this note’s cards.
				</div>
				<button
					type="button"
					class="ep:rounded-md ep:border ep:border-obs-border ep:bg-transparent ep:px-3 ep:py-1.5 ep:text-ui-small ep:text-obs-normal ep:cursor-pointer ep:touch-manipulation ep:hover:bg-obs-modifier-hover"
					onClick={onResetList}
				>
					Clear Search & Filters
				</button>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col" role="list" aria-label="Cards">
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const item = items[virtualRow.index];
					if (!item) return null;

					return (
						<div
							key={virtualRow.key}
							ref={virtualizer.measureElement}
							data-index={virtualRow.index}
							role="listitem"
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							{item.type === "io-group" ? (
								<PanelIOGroup
									cards={item.cards}
									fsrsCards={item.fsrsCards}
									selectedCount={item.cards.reduce(
										(count, card) =>
											count + (selectedCardIds.has(card.id) ? 1 : 0),
										0,
									)}
									isSelectionMode={isSelectionMode}
									actions={actions}
									sourcePath={currentFile.path}
								/>
							) : (
								<PanelCard
									card={item.card}
									fsrsCard={fsrsMap.get(item.card.id)}
									isSelected={selectedCardIds.has(item.card.id)}
									isSelectionMode={isSelectionMode}
									searchQuery={searchQuery}
									dayStartHour={dayStartHour}
									sourcePath={currentFile.path}
									actions={actions}
								/>
							)}
						</div>
					);
				})}
			</div>
			{isStreamingForFile ? (
				<StreamingSection currentFilePath={currentFile.path} />
			) : null}
		</div>
	);
}
