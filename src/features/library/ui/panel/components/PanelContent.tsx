import {
	clearRecentCards,
	streamingGeneration,
} from "@features/ai/services/streaming-state";
import { PanelCard } from "@features/library/ui/panel/components/PanelCard";
import { PanelEmptyState } from "@features/library/ui/panel/components/PanelEmptyState";
import { PanelIOGroup } from "@features/library/ui/panel/components/PanelIOGroup";
import { PartialCard } from "@features/library/ui/panel/components/PartialCard";
import { groupCards } from "@features/library/ui/panel/group-cards";
import { matchesCardSearch } from "@features/library/ui/panel/utils/search-query.utils";
import { useSignalEffect } from "@preact/signals";
import type { SelectionMode } from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { EmptyState, EmptyStateMessages } from "@shared/ui/components";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface ContentHandlers {
	onEditButton: (card: FlashcardItem) => void;
	onDeleteCard: (card: FlashcardItem) => void;
	onCopyCard: (card: FlashcardItem) => void;
	onMoveCard: (card: FlashcardItem) => void;
	onChangeType: (card: FlashcardItem) => void;
	onToggleReversed: (card: FlashcardItem) => void;
	onForgetCard: (card: FlashcardItem) => void;
	onToggleExpand: (cardId: string) => void;
	onToggleSelect: (cardId: string) => void;
	onEnterSelectionMode: (cardId: string) => void;
	onAdd: () => void;
	onJumpToSource: (card: FlashcardItem) => void;
	onHoverSource: (card: FlashcardItem) => void;
	onLeaveSource: () => void;
}

export interface PanelContentProps {
	flashcardInfo: FlashcardInfo | null;
	currentFile: { path: string; extension: string } | null;
	status: string;
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	cardsWithFsrs: FSRSFlashcardItem[];
	searchQuery: string;
	handlers: ContentHandlers;
	onGenerateFromNote: () => Promise<void>;
	onGenerateFromHighlights: () => Promise<void>;
	onCollect: () => Promise<void>;
	uncollectedCount: number;
	hasApiKey: boolean;
	hasHighlights: boolean;
}

// ── Streaming subscription helpers ──────────────────────────────

const SCROLL_THROTTLE_MS = 250;
const NEAR_BOTTOM_PX = 80;

function findScrollParent(el: HTMLElement): HTMLElement | null {
	let node = el.parentElement;
	while (node) {
		const { overflowY } = getComputedStyle(node);
		if (overflowY === "auto" || overflowY === "scroll") return node;
		node = node.parentElement;
	}
	return null;
}

function isNearBottom(scroller: HTMLElement): boolean {
	return (
		scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
		NEAR_BOTTOM_PX
	);
}

function StreamingSection({
	currentFilePath,
}: {
	currentFilePath: string | null;
}) {
	const [, forceUpdate] = useState(0);
	useSignalEffect(() => {
		const _ = streamingGeneration.value;
		forceUpdate((n) => n + 1);
	});

	const streaming = streamingGeneration.value;
	const isActive =
		streaming.isGenerating && streaming.notePath === currentFilePath;

	const sentinelRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLElement | null>(null);
	const lastScrollRef = useRef(0);
	const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();
	const wasNearBottomRef = useRef(true);

	useEffect(() => {
		if (sentinelRef.current) {
			scrollerRef.current = findScrollParent(sentinelRef.current);
		}
	}, []);

	useEffect(() => {
		if (!isActive) return;
		const scroller = scrollerRef.current;
		if (!scroller) return;

		const nearBottom = isNearBottom(scroller);
		if (nearBottom) wasNearBottomRef.current = true;
		if (!nearBottom && !wasNearBottomRef.current) return;
		if (!nearBottom) {
			wasNearBottomRef.current = false;
			return;
		}

		const scrollToEnd = () => {
			scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
			lastScrollRef.current = Date.now();
		};

		const now = Date.now();
		const elapsed = now - lastScrollRef.current;

		if (elapsed >= SCROLL_THROTTLE_MS) {
			scrollToEnd();
		} else {
			clearTimeout(scrollTimerRef.current);
			scrollTimerRef.current = setTimeout(
				scrollToEnd,
				SCROLL_THROTTLE_MS - elapsed,
			);
		}

		return () => clearTimeout(scrollTimerRef.current);
	});

	if (!isActive) return null;

	return (
		<>
			<PartialCard streaming={streaming} />
			<div ref={sentinelRef} />
		</>
	);
}

function useStreamingCardState() {
	const [, forceUpdate] = useState(0);
	const prevRef = useRef({
		isGenerating: false,
		completedCount: 0,
		recentCount: 0,
		notePath: null as string | null,
	});

	useSignalEffect(() => {
		const s = streamingGeneration.value;
		const prev = prevRef.current;
		if (
			prev.isGenerating !== s.isGenerating ||
			prev.completedCount !== s.completedCards.length ||
			prev.recentCount !== s.recentCardIds.size ||
			prev.notePath !== s.notePath
		) {
			prevRef.current = {
				isGenerating: s.isGenerating,
				completedCount: s.completedCards.length,
				recentCount: s.recentCardIds.size,
				notePath: s.notePath,
			};
			forceUpdate((n) => n + 1);
		}
	});

	return streamingGeneration.peek();
}

// ── Main component ──────────────────────────────────────────────

export function PanelContent({
	flashcardInfo,
	currentFile,
	status: _status,
	selectionMode,
	selectedCardIds,
	expandedCardIds,
	cardsWithFsrs,
	searchQuery,
	handlers,
	onGenerateFromNote,
	onGenerateFromHighlights,
	onCollect,
	uncollectedCount,
	hasApiKey,
	hasHighlights,
}: PanelContentProps) {
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
			(c) => !existingIds.has(c.id),
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
		return (
			<PanelEmptyState
				onGenerate={onGenerateFromNote}
				onGenerateFromHighlights={onGenerateFromHighlights}
				onCollect={onCollect}
				uncollectedCount={uncollectedCount}
				hasApiKey={hasApiKey}
				hasHighlights={hasHighlights}
			/>
		);
	}

	const filePath = currentFile.path;
	const isSelecting = selectionMode === "selecting";

	let recentIndex = 0;

	return (
		<div class="ep:flex ep:flex-col">
			{filteredItems.map((item) => {
				if (item.type === "io-group") {
					const firstCard = item.cards[0]!;
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
							onToggleExpand={() => handlers.onToggleExpand(groupKey)}
							onToggleSelect={() => {
								for (const c of item.cards) handlers.onToggleSelect(c.id);
							}}
							onEdit={() => handlers.onEditButton(firstCard)}
							onDelete={() => {
								for (const c of item.cards) handlers.onDeleteCard(c);
							}}
							onMove={() => handlers.onMoveCard(firstCard)}
							onSelect={() => handlers.onEnterSelectionMode(firstCard.id)}
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
						onToggleExpand={() => handlers.onToggleExpand(card.id)}
						onToggleSelect={() => handlers.onToggleSelect(card.id)}
						onSelect={() => handlers.onEnterSelectionMode(card.id)}
						onLongPress={() => handlers.onEnterSelectionMode(card.id)}
						onEdit={() => handlers.onEditButton(card)}
						onDelete={() => handlers.onDeleteCard(card)}
						onCopy={() => handlers.onCopyCard(card)}
						onMove={() => handlers.onMoveCard(card)}
						onChangeType={() => handlers.onChangeType(card)}
						onToggleReversed={() => handlers.onToggleReversed(card)}
						onForget={() => handlers.onForgetCard(card)}
						onJumpToSource={
							card.sourceText ? () => handlers.onJumpToSource(card) : undefined
						}
						onHoverSource={
							card.sourceText ? () => handlers.onHoverSource(card) : undefined
						}
						onLeaveSource={card.sourceText ? handlers.onLeaveSource : undefined}
					/>
				);
			})}
			{isStreamingForFile && (
				<StreamingSection currentFilePath={currentFile?.path ?? null} />
			)}
		</div>
	);
}
