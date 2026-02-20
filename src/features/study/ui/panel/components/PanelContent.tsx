import { useMemo } from "preact/hooks";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import type { SelectionMode } from "@shared/store";
import { EmptyState, EmptyStateMessages } from "@shared/ui/components";
import { CompactCard } from "@features/study/ui/panel/components/CompactCard";
import { CardGroup } from "@features/study/ui/panel/components/CardGroup";
import { groupCards } from "@features/study/ui/panel/group-cards";

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

	if (!flashcardInfo?.exists) {
		return (
			<div class="ep:py-4 ep:text-center">
				<p class="ep:text-ui-small ep:text-obs-muted ep:m-0">No flashcards</p>
			</div>
		);
	}

	const filePath = currentFile.path;

	return (
		<div class="ep:flex ep:flex-col">
			{filteredItems.map((item) => {
				if (item.type === "basic") {
					return (
						<CompactCard
							key={item.card.id}
							card={item.card}
							fsrsCard={fsrsMap.get(item.card.id)}
							filePath={filePath}
							isExpanded={expandedCardIds.has(item.card.id)}
							isSelected={selectedCardIds.has(item.card.id)}
							isSelectionMode={selectionMode === "selecting"}
							onToggleExpand={() => handlers.onToggleExpand(item.card.id)}
							onToggleSelect={() => handlers.onToggleSelect(item.card.id)}
							onEdit={() => handlers.onEditButton(item.card)}
							onDelete={() => handlers.onDeleteCard(item.card)}
							onCopy={() => handlers.onCopyCard(item.card)}
							onMove={() => handlers.onMoveCard(item.card)}
							onSelect={() => handlers.onEnterSelectionMode(item.card.id)}
							onLongPress={() => handlers.onEnterSelectionMode(item.card.id)}
						/>
					);
				}

				if (item.type === "cloze-group") {
					const groupId = `cloze:${item.cards[0]?.id}`;
					return (
						<CardGroup
							key={groupId}
							groupType="cloze"
							cards={item.cards}
							fsrsCards={item.cards.map((c) => fsrsMap.get(c.id))}
							template={item.template}
							filePath={filePath}
							groupId={groupId}
							isExpanded={expandedCardIds.has(groupId)}
							isSelected={item.cards.some((c) => selectedCardIds.has(c.id))}
							isSelectionMode={selectionMode === "selecting"}
							onToggleExpand={() => handlers.onToggleExpand(groupId)}
							onToggleSelect={() => {
								for (const c of item.cards) handlers.onToggleSelect(c.id);
							}}
							onEditGroup={() =>
								handlers.onEditGroup(item.cards, item.template)
							}
							onDeleteGroup={() => handlers.onDeleteGroup(item.cards)}
							onCopyGroup={() => handlers.onCopyGroup(item.cards)}
							onMoveGroup={() => handlers.onMoveGroup(item.cards)}
							onSelect={() =>
								handlers.onEnterSelectionMode(item.cards[0]?.id ?? "")
							}
							onLongPress={() =>
								handlers.onEnterSelectionMode(item.cards[0]?.id ?? "")
							}
						/>
					);
				}

				// reverse-group
				const groupId = `reverse:${item.original.id}`;
				const reverseCards = [item.original, item.reversed];
				return (
					<CardGroup
						key={groupId}
						groupType="reverse"
						cards={reverseCards}
						fsrsCards={reverseCards.map((c) => fsrsMap.get(c.id))}
						filePath={filePath}
						groupId={groupId}
						isExpanded={expandedCardIds.has(groupId)}
						isSelected={reverseCards.some((c) => selectedCardIds.has(c.id))}
						isSelectionMode={selectionMode === "selecting"}
						onToggleExpand={() => handlers.onToggleExpand(groupId)}
						onToggleSelect={() => {
							for (const c of reverseCards) handlers.onToggleSelect(c.id);
						}}
						onEditGroup={() => handlers.onEditGroup(reverseCards)}
						onDeleteGroup={() => handlers.onDeleteGroup(reverseCards)}
						onCopyGroup={() => handlers.onCopyGroup(reverseCards)}
						onMoveGroup={() => handlers.onMoveGroup(reverseCards)}
						onSelect={() => handlers.onEnterSelectionMode(item.original.id)}
						onLongPress={() => handlers.onEnterSelectionMode(item.original.id)}
					/>
				);
			})}
		</div>
	);
}
