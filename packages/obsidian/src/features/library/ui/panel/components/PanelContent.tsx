import { useVirtualizer } from "@tanstack/react-virtual";
import { clearRecentCards } from "@true-recall/core/ai/state/streaming-state";
import {
	EmptyState,
	EmptyStateMessages,
} from "@true-recall/obsidian/components";
import { PanelCard } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCard";
import { PanelEmptyState } from "@true-recall/obsidian/features/library/ui/panel/components/PanelEmptyState";
import { PanelIOGroup } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIOGroup";
import {
	StreamingSection,
	useStreamingCardState,
} from "@true-recall/obsidian/features/library/ui/panel/components/StreamingSection";
import { groupCards } from "@true-recall/obsidian/features/library/ui/panel/group-cards";
import { usePanelScroll } from "@true-recall/obsidian/features/library/ui/panel/hooks/PanelScrollContext";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { matchesCardSearch } from "@true-recall/obsidian/features/library/ui/panel/utils/search-query.utils";
import { useEffect, useMemo } from "preact/hooks";

export function PanelContent() {
	const {
		flashcardInfo,
		currentFile,
		selectionMode,
		selectedCardIds,
		expandedCardIds,
		cardsWithFsrs,
		searchQuery,
	} = usePanelStore();

	const { scrollRef } = usePanelScroll();

	const fsrsMap = useMemo(
		() => new Map(cardsWithFsrs.map((c) => [c.id, c])),
		[cardsWithFsrs],
	);

	const flashcards = flashcardInfo?.exists ? flashcardInfo.flashcards : [];

	const streaming = useStreamingCardState();
	const isStreamingForFile =
		streaming.isGenerating && streaming.notePath === currentFile?.path;
	const { recentCardIds } = streaming;

	const allFlashcards = useMemo(() => {
		if (!isStreamingForFile || streaming.completedCards.length === 0)
			return flashcards;
		const existingIds = new Set(flashcards.map((c) => c.id));
		const newCards = streaming.completedCards.filter(
			(c: { id: string }) => !existingIds.has(c.id),
		);
		if (newCards.length === 0) return flashcards;
		return [...flashcards, ...newCards];
	}, [flashcards, isStreamingForFile, streaming.completedCards]);

	const items = useMemo(
		() => groupCards(allFlashcards, fsrsMap),
		[allFlashcards, fsrsMap],
	);

	const filteredItems = useMemo(() => {
		if (!searchQuery.trim()) return items;
		return items.filter((item) => {
			if (item.type === "io-group") {
				return item.cards.some((c) =>
					matchesCardSearch(c.question, c.answer, searchQuery),
				);
			}
			return matchesCardSearch(
				item.card.question,
				item.card.answer,
				searchQuery,
			);
		});
	}, [items, searchQuery]);

	useEffect(() => {
		if (!streaming.isGenerating && recentCardIds.size > 0) {
			const timer = setTimeout(() => clearRecentCards(), 1000);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [streaming.isGenerating, recentCardIds.size]);

	const virtualizer = useVirtualizer({
		count: filteredItems.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 56,
		overscan: 5,
	});

	if (!currentFile) {
		return <EmptyState message={EmptyStateMessages.NO_FILE} />;
	}

	if (currentFile.extension !== "md") {
		return <EmptyState message={EmptyStateMessages.NOT_MARKDOWN} />;
	}

	if (!flashcardInfo?.exists && !isStreamingForFile) {
		return <PanelEmptyState />;
	}

	const filePath = currentFile.path;
	const isSelecting = selectionMode === "selecting";

	return (
		<div class="ep:flex ep:flex-col">
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const item = filteredItems[virtualRow.index];
					if (!item) return null;

					return (
						<div
							key={virtualRow.key}
							ref={virtualizer.measureElement}
							data-index={virtualRow.index}
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
									filePath={filePath}
									isExpanded={expandedCardIds.has(item.cards[0]?.id ?? "")}
									isSelected={item.cards.every((c) =>
										selectedCardIds.has(c.id),
									)}
									isSelectionMode={isSelecting}
								/>
							) : (
								<PanelCard
									card={item.card}
									fsrsCard={fsrsMap.get(item.card.id)}
									filePath={filePath}
									isExpanded={expandedCardIds.has(item.card.id)}
									isSelected={selectedCardIds.has(item.card.id)}
									isSelectionMode={isSelecting}
								/>
							)}
						</div>
					);
				})}
			</div>
			{isStreamingForFile && (
				<StreamingSection currentFilePath={currentFile?.path ?? null} />
			)}
		</div>
	);
}
