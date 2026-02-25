import {
	clearRecentCards,
	streamingGeneration,
} from "@features/ai/services/streaming-state";
import { PanelCard } from "@features/library/ui/panel/components/PanelCard";
import { PanelEmptyState } from "@features/library/ui/panel/components/PanelEmptyState";
import {
	groupCards,
	type PanelItem,
} from "@features/library/ui/panel/group-cards";
import type { SelectionMode } from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { useStreamingText } from "@features/library/ui/panel/hooks";
import { EmptyState, EmptyStateMessages } from "@shared/ui/components";
import { useEffect, useMemo, useRef } from "preact/hooks";

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
	const grouped = useMemo(() => groupCards(flashcards), [flashcards]);

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

	if (!currentFile) {
		return <EmptyState message={EmptyStateMessages.NO_FILE} />;
	}

	if (currentFile.extension !== "md") {
		return <EmptyState message={EmptyStateMessages.NOT_MARKDOWN} />;
	}

	const streaming = streamingGeneration.value;
	const isStreamingForFile =
		streaming.isGenerating && streaming.notePath === currentFile?.path;
	const { recentCardIds } = streaming;

	useEffect(() => {
		if (!streaming.isGenerating && recentCardIds.size > 0) {
			const timer = setTimeout(() => clearRecentCards(), 500);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [streaming.isGenerating, recentCardIds.size]);

	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isStreamingForFile) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
		}
	}, [isStreamingForFile, recentCardIds.size, streaming.partialQuestion]);

	if (!flashcardInfo?.exists) {
		if (isStreamingForFile) {
			return (
				<div class="ep:flex ep:flex-col">
					<PartialCard streaming={streaming} />
				</div>
			);
		}
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

	return (
		<div class="ep:flex ep:flex-col">
			{filteredItems.map((item) => {
				const { key, cards, template } = getItemInfo(item);
				const primaryCard = cards[0]!;
				const isNewlyStreamed = recentCardIds.has(primaryCard.id);

				const sharedProps = {
					filePath,
					isExpanded: expandedCardIds.has(key),
					isSelected:
						item.type === "basic"
							? selectedCardIds.has(key)
							: cards.some((c) => selectedCardIds.has(c.id)),
					isSelectionMode: isSelecting,
					onToggleExpand: () => handlers.onToggleExpand(key),
					onToggleSelect:
						item.type === "basic"
							? () => handlers.onToggleSelect(key)
							: () => {
									for (const c of cards) handlers.onToggleSelect(c.id);
								},
					onSelect: () => handlers.onEnterSelectionMode(primaryCard.id),
					onLongPress: () => handlers.onEnterSelectionMode(primaryCard.id),
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
					const card = (
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
					return isNewlyStreamed ? (
						<div key={key} class="ep-animate-slide-in">
							{card}
						</div>
					) : (
						card
					);
				}

				const groupType =
					item.type === "cloze-group"
						? ("cloze" as const)
						: ("reverse" as const);
				const groupCard = (
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
				return isNewlyStreamed ? (
					<div key={key} class="ep-animate-slide-in">
						{groupCard}
					</div>
				) : (
					groupCard
				);
			})}
			{isStreamingForFile && <PartialCard streaming={streaming} />}
			{isStreamingForFile && <div ref={bottomRef} />}
		</div>
	);
}

function PartialCard({
	streaming,
}: { streaming: typeof streamingGeneration.value }) {
	const { visibleText: question, isTyping: qTyping } = useStreamingText(
		streaming.partialQuestion ?? "",
	);
	const { visibleText: answer, isTyping: aTyping } = useStreamingText(
		streaming.partialAnswer ?? "",
	);

	if (!question) {
		return (
			<div class="ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3 ep:items-center ep:gap-2">
				<div class="ep:text-xs ep:text-obs-muted">
					Generating flashcards...
				</div>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3 ep-animate-slide-in">
			<div class="ep:text-ui-small ep:text-obs-normal">
				{question}
				{qTyping && <span class="ep-streaming-cursor" />}
			</div>
			{(answer || streaming.partialAnswer != null) && (
				<div class="ep:text-ui-small ep:text-obs-muted ep:mt-1.5 ep:leading-relaxed">
					{answer}
					{aTyping && <span class="ep-streaming-cursor" />}
				</div>
			)}
		</div>
	);
}
