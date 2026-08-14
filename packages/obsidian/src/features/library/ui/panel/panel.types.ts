import type { FlashcardItem } from "@true-recall/core/types";

export interface PanelCardActionHandlers {
	onOpen: (card: FlashcardItem) => void;
	onOpenSource: (card: FlashcardItem) => void;
	onEdit: (card: FlashcardItem) => void;
	onCopy: (card: FlashcardItem) => void;
	onMove: (card: FlashcardItem) => void;
	onChangeType: (card: FlashcardItem) => void;
	onToggleReversed: (card: FlashcardItem) => void;
	onForget: (card: FlashcardItem) => void;
	onSuspend: (card: FlashcardItem) => void;
	onUnsuspend: (card: FlashcardItem) => void;
	onDelete: (card: FlashcardItem) => void;
	onUpdateContent: (
		card: FlashcardItem,
		value: string,
		field: "question" | "answer",
	) => void;
	onEnterSelection: (cardId: string) => void;
	onSetSelected: (cardIds: string[], selected: boolean) => void;
	onHoverSource: (card: FlashcardItem) => void;
	onLeaveSource: () => void;
}
