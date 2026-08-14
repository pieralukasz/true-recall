import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import { isSuspended } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import {
	type MenuItem,
	useContextMenu,
} from "@true-recall/obsidian/preact/useContextMenu";

interface UsePanelCardMenuArgs {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	actions: PanelCardActionHandlers;
	variant: "row" | "detail";
	isSelectionMode?: boolean;
}

export function usePanelCardMenu({
	card,
	fsrsCard,
	actions,
	variant,
	isSelectionMode = false,
}: UsePanelCardMenuArgs) {
	const items =
		variant === "detail"
			? createDetailMenu(card, fsrsCard, actions)
			: createRowMenu(card, fsrsCard, actions, isSelectionMode);
	return useContextMenu(items);
}

function createDetailMenu(
	card: FlashcardItem,
	fsrsCard: FSRSFlashcardItem | undefined,
	actions: PanelCardActionHandlers,
): MenuItem[] {
	return [
		{ title: "Edit", icon: "pencil", onClick: () => actions.onEdit(card) },
		{
			title: "Open Source",
			icon: "file-text",
			onClick: () => actions.onOpenSource(card),
		},
		{ title: "Copy", icon: "copy", onClick: () => actions.onCopy(card) },
		{
			title: "Move",
			icon: "folder-input",
			onClick: () => actions.onMove(card),
		},
		"separator",
		createSuspendAction(card, fsrsCard, actions),
		{
			title: "Forget",
			icon: "rotate-ccw",
			onClick: () => actions.onForget(card),
		},
		"separator",
		{ title: "Delete", icon: "trash-2", onClick: () => actions.onDelete(card) },
	];
}

function createRowMenu(
	card: FlashcardItem,
	fsrsCard: FSRSFlashcardItem | undefined,
	actions: PanelCardActionHandlers,
	isSelectionMode: boolean,
): MenuItem[] {
	return [
		{
			title: "Open Card",
			icon: "panel-right-open",
			onClick: () => actions.onOpen(card),
		},
		{ title: "Edit", icon: "pencil", onClick: () => actions.onEdit(card) },
		{
			title: "Open Source",
			icon: "file-text",
			onClick: () => actions.onOpenSource(card),
		},
		{ title: "Copy", icon: "copy", onClick: () => actions.onCopy(card) },
		{
			title: "Move",
			icon: "folder-input",
			onClick: () => actions.onMove(card),
		},
		{
			title: "More",
			icon: "ellipsis",
			children: createMoreActions(card, fsrsCard, actions),
		},
		"separator",
		{ title: "Delete", icon: "trash-2", onClick: () => actions.onDelete(card) },
		...(!isSelectionMode
			? ([
					"separator",
					{
						title: "Select",
						icon: "check-square",
						onClick: () => actions.onEnterSelection(card.id),
					},
				] satisfies MenuItem[])
			: []),
	];
}

function createMoreActions(
	card: FlashcardItem,
	fsrsCard: FSRSFlashcardItem | undefined,
	actions: PanelCardActionHandlers,
): MenuItem[] {
	return [
		{
			title: "Change Note Type",
			icon: "replace",
			onClick: () => actions.onChangeType(card),
		},
		...(canToggleReversed(card)
			? ([
					{
						title:
							card.cardType === "reversed"
								? "Remove Reversed"
								: "Make Reversed",
						icon: "arrow-left-right",
						onClick: () => actions.onToggleReversed(card),
					},
				] satisfies MenuItem[])
			: []),
		{
			title: "Forget",
			icon: "rotate-ccw",
			onClick: () => actions.onForget(card),
		},
		createSuspendAction(card, fsrsCard, actions),
	];
}

function createSuspendAction(
	card: FlashcardItem,
	fsrsCard: FSRSFlashcardItem | undefined,
	actions: PanelCardActionHandlers,
): MenuItem {
	return isSuspended(fsrsCard)
		? {
				title: "Unsuspend",
				icon: "play",
				onClick: () => actions.onUnsuspend(card),
			}
		: {
				title: "Suspend",
				icon: "pause",
				onClick: () => actions.onSuspend(card),
			};
}

function canToggleReversed(card: FlashcardItem): boolean {
	return !["cloze", "image-occlusion", "note-review"].includes(
		card.cardType ?? "basic",
	);
}
