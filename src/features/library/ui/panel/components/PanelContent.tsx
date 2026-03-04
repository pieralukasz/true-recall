import {
	clearRecentCards,
	streamingGeneration,
} from "@features/ai/services/streaming-state";
import { PanelCard } from "@features/library/ui/panel/components/PanelCard";
import { PartialCard } from "@features/library/ui/panel/components/PartialCard";
import { PanelEmptyState } from "@features/library/ui/panel/components/PanelEmptyState";
import {
	groupCards,
	type PanelItem,
} from "@features/library/ui/panel/group-cards";
import type { SelectionMode } from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { EmptyState, EmptyStateMessages } from "@shared/ui/components";
import { useSignalEffect } from "@preact/signals";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface ContentHandlers {
	onEditButton: (card: FlashcardItem) => void;
	onDeleteCard: (card: FlashcardItem) => void;
	onCopyCard: (card: FlashcardItem) => void;
	onMoveCard: (card: FlashcardItem) => void;
	onToggleExpand: (cardId: string) => void;
	onToggleSelect: (cardId: string) => void;
	onEnterSelectionMode: (cardId: string) => void;
	onAdd: () => void;
	onEditGroup: (cards: FlashcardItem[], template?: string) => void;
	onDeleteGroup: (cards: FlashcardItem[]) => void;
	onCopyGroup: (cards: FlashcardItem[]) => void;
	onMoveGroup: (cards: FlashcardItem[]) => void;
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

function getItemInfo(item: PanelItem): {
	key: string;
	cards: FlashcardItem[];
	template?: string;
} {
	switch (item.type) {
		case "basic":
			return { key: item.card.id, cards: [item.card] };
		case "cloze-group":
			return {
				key: `cloze:${item.cards[0]?.id}`,
				cards: item.cards,
				template: item.template,
			};
		case "reverse-group":
			return {
				key: `reverse:${item.original.id}`,
				cards: [item.original, item.reversed],
			};
	}
}

// ── Streaming subscription helpers ──────────────────────────────

const SCROLL_THROTTLE_MS = 250;
// User is "near bottom" if within this many pixels of the scroll end
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

/** Subscribes to the full signal at ~60Hz but only renders PartialCard + scroll anchor. */
function StreamingSection({
	currentFilePath,
}: { currentFilePath: string | null }) {
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
	// Track if user was near bottom — sticky until user scrolls away
	const wasNearBottomRef = useRef(true);

	// Resolve scroll container once on mount
	useEffect(() => {
		if (sentinelRef.current) {
			scrollerRef.current = findScrollParent(sentinelRef.current);
		}
	}, []);

	// Throttled auto-scroll: only scrolls when user is near the bottom
	useEffect(() => {
		if (!isActive) return;
		const scroller = scrollerRef.current;
		if (!scroller) return;

		// Check if user is near bottom (or was near bottom recently)
		const nearBottom = isNearBottom(scroller);
		if (nearBottom) wasNearBottomRef.current = true;
		// If user scrolled far up, stop auto-scrolling until they return to bottom
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

/**
 * Coarse subscription: only re-renders PanelContent when card-level state changes
 * (completedCards.length, recentCardIds.size, isGenerating, notePath).
 * High-frequency partialQuestion/partialAnswer updates are handled by StreamingSection.
 *
 * Uses ref comparison + forceUpdate instead of setSnapshot(prev => ...) because
 * Preact's functional-updater bail-out is unreliable inside useSignalEffect.
 */
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

	// During streaming, merge completed cards that aren't yet in flashcardInfo
	// to bypass the 100ms debounced SQLite refresh and show each card immediately
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

	const grouped = useMemo(() => groupCards(allFlashcards), [allFlashcards]);

	const filteredItems = useMemo(() => {
		if (!searchQuery) return grouped;
		return grouped.filter((item) => {
			if (item.type === "basic") {
				return (
					item.card.question.toLowerCase().includes(searchQuery) ||
					item.card.answer.toLowerCase().includes(searchQuery)
				);
			}
			if (item.type === "cloze-group") {
				return item.cards.some(
					(c) =>
						c.question.toLowerCase().includes(searchQuery) ||
						c.answer.toLowerCase().includes(searchQuery),
				);
			}
			return (
				item.original.question.toLowerCase().includes(searchQuery) ||
				item.original.answer.toLowerCase().includes(searchQuery) ||
				item.reversed.question.toLowerCase().includes(searchQuery) ||
				item.reversed.answer.toLowerCase().includes(searchQuery)
			);
		});
	}, [grouped, searchQuery]);

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
				const { key, cards, template } = getItemInfo(item);
				const primaryCard = cards[0]!;
				// For groups, check if any card is newly streamed (not just the first one)
				const isNewlyStreamed =
					item.type === "basic"
						? recentCardIds.has(primaryCard.id)
						: cards.some((c) => recentCardIds.has(c.id));
				const cardIndex = isNewlyStreamed ? recentIndex++ : 0;

				const animationProps = isNewlyStreamed
					? {
							enterClass: "ep-card-enter ep-card-complete",
							enterStyle: {
								"--card-index": cardIndex,
							} as Record<string, string | number>,
						}
					: {};

				const sharedProps = {
					filePath,
					isExpanded: expandedCardIds.has(key),
					isSelected:
						item.type === "basic"
							? selectedCardIds.has(key)
							: cards.some((c) => selectedCardIds.has(c.id)),
					isSelectionMode: isSelecting,
					...animationProps,
					onToggleExpand: () => handlers.onToggleExpand(key),
					onToggleSelect:
						item.type === "basic"
							? () => handlers.onToggleSelect(key)
							: () => {
									for (const c of cards)
										handlers.onToggleSelect(c.id);
								},
					onSelect: () =>
						handlers.onEnterSelectionMode(primaryCard.id),
					onLongPress: () =>
						handlers.onEnterSelectionMode(primaryCard.id),
					onJumpToSource: primaryCard.sourceText
						? () => handlers.onJumpToSource(primaryCard)
						: undefined,
					onHoverSource: primaryCard.sourceText
						? () => handlers.onHoverSource(primaryCard)
						: undefined,
					onLeaveSource: primaryCard.sourceText
						? handlers.onLeaveSource
						: undefined,
				};

				if (item.type === "basic") {
					return (
						<PanelCard
							key={key}
							variant="basic"
							card={item.card}
							fsrsCard={fsrsMap.get(item.card.id)}
							onEdit={() => handlers.onEditButton(item.card)}
							onDelete={() => handlers.onDeleteCard(item.card)}
							onCopy={() => handlers.onCopyCard(item.card)}
							onMove={() => handlers.onMoveCard(item.card)}
							{...sharedProps}
						/>
					);
				}

				const groupType =
					item.type === "cloze-group"
						? ("cloze" as const)
						: ("reverse" as const);
				return (
					<PanelCard
						key={key}
						variant="group"
						groupType={groupType}
						cards={cards}
						fsrsCards={cards.map((c) => fsrsMap.get(c.id))}
						template={template}
						onEdit={() => handlers.onEditGroup(cards, template)}
						onDelete={() => handlers.onDeleteGroup(cards)}
						onCopy={() => handlers.onCopyGroup(cards)}
						onMove={() => handlers.onMoveGroup(cards)}
						{...sharedProps}
					/>
				);
			})}
			{isStreamingForFile && (
				<StreamingSection
					currentFilePath={currentFile?.path ?? null}
				/>
			)}
		</div>
	);
}
