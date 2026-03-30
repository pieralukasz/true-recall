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

	let recentIndex = 0;

	return (
		<div class="ep:flex ep:flex-col">
			{filteredItems.map((item) => {
				if (item.type === "io-group") {
					const firstCard = item.cards[0];
					if (!firstCard) return null;
					const groupKey = firstCard.id;
					const allSelected = item.cards.every((c) =>
						selectedCardIds.has(c.id),
					);
					return (
						<PanelIOGroup
							key={`io-${groupKey}`}
							cards={item.cards}
							fsrsCards={item.fsrsCards}
							filePath={filePath}
							isExpanded={expandedCardIds.has(groupKey)}
							isSelected={allSelected}
							isSelectionMode={isSelecting}
						/>
					);
				}

				const { card } = item;
				const isNewlyStreamed = recentCardIds.has(card.id);
				const cardIndex = isNewlyStreamed ? recentIndex++ : 0;

				const animationProps = isNewlyStreamed
					? {
							enterClass: "ep-card-enter ep-card-complete",
							enterStyle: {
								"--card-index": cardIndex,
							} as Record<string, string | number>,
						}
					: {};

				return (
					<PanelCard
						key={card.id}
						card={card}
						fsrsCard={fsrsMap.get(card.id)}
						filePath={filePath}
						isExpanded={expandedCardIds.has(card.id)}
						isSelected={selectedCardIds.has(card.id)}
						isSelectionMode={isSelecting}
						{...animationProps}
					/>
				);
			})}
			{isStreamingForFile && (
				<StreamingSection currentFilePath={currentFile?.path ?? null} />
			)}
		</div>
	);
}
