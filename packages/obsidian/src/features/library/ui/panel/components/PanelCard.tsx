import { cva } from "class-variance-authority";
import { memo } from "preact/compat";
import { useCallback } from "preact/hooks";

import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { Clickable } from "@true-recall/obsidian/components";
import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";
import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { useSelectionActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useSelectionActions";
import {
	getHighlightColor,
	getStatusTitle,
	isBuried,
	isSuspended,
} from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import {
	type MenuItem,
	useContextMenu,
} from "@true-recall/obsidian/preact/useContextMenu";
import { useLongPress } from "@true-recall/obsidian/preact/useLongPress";
import { cn } from "@true-recall/obsidian/utils";

// ── Variants ────────────────────────────────────────────────

const panelCardVariants = cva(
	"ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-surface-raised ep:border-[1px] ep:border-obs-border/20 ep:shadow-raised ep:hover:bg-obs-modifier-hover ep:transition-colors ep:duration-300",
	{
		variants: {
			state: {
				green: "ep:hover:border-obs-green/30",
				orange: "ep:hover:border-obs-orange/30",
				blue: "ep:hover:border-obs-blue/30",
				red: "ep:hover:border-obs-red/30",
				default: "ep:hover:border-obs-border",
			},
		},
		defaultVariants: { state: "default" },
	},
);

// ── Types ──────────────────────────────────────────────────

export interface PanelCardProps {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	filePath: string;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	enterClass?: string;
	enterStyle?: Record<string, string | number>;
}

// ── Sub-components ──────────────────────────────────────────

function CardStatusBadge({ fsrsCard }: { fsrsCard?: FSRSFlashcardItem }) {
	if (isSuspended(fsrsCard)) {
		return (
			<span
				class="ep:text-ui-smaller ep:text-obs-red ep:font-medium ep:shrink-0"
				title="Suspended - excluded from review"
			>
				S
			</span>
		);
	}
	if (isBuried(fsrsCard)) {
		return (
			<span
				class="ep:text-ui-smaller ep:text-obs-faint ep:font-medium ep:shrink-0"
				title={`Buried until ${new Date(fsrsCard?.fsrs.buriedUntil ?? "").toLocaleDateString()}`}
			>
				B
			</span>
		);
	}
	return null;
}

function CardTypeBadge({ card }: { card: FlashcardItem }) {
	if (card.cardType === "cloze" && card.clozeIndex != null) {
		return (
			<span
				class="ep:text-xs ep:text-obs-muted ep:bg-obs-base-25 ep:rounded-full ep:px-1.5 ep:py-0.5 ep:shrink-0 ep:leading-none"
				title="Cloze deletion"
			>
				C{card.clozeIndex}
			</span>
		);
	}
	if (card.cardType === "reversed") {
		return (
			<span
				class="ep:text-xs ep:text-obs-muted ep:bg-obs-base-25 ep:rounded-full ep:px-1.5 ep:py-0.5 ep:shrink-0 ep:leading-none"
				title="Reversed card"
			>
				⇄
			</span>
		);
	}
	if (card.cardType === "note-review") {
		return (
			<span
				class="ep:text-xs ep:text-obs-muted ep:bg-obs-base-25 ep:rounded-full ep:px-1.5 ep:py-0.5 ep:shrink-0 ep:leading-none"
				title="Note review"
			>
				NR
			</span>
		);
	}
	return null;
}

// ── Main component ─────────────────────────────────────────

export const PanelCard = memo(function PanelCard({
	card,
	fsrsCard,
	filePath,
	isExpanded,
	isSelected,
	isSelectionMode,
	enterClass,
	enterStyle,
}: PanelCardProps) {
	const app = useApp();
	const cardActions = useCardActions();
	const selectionActions = useSelectionActions();
	const panelActions = usePanelActions();

	const { handlers: longPressHandlers, wasLongPress } = useLongPress({
		onLongPress: () => selectionActions.handleEnterSelectionMode(card.id),
	});

	const handleLinkClick = useCallback(
		(href: string) => void app.workspace.openLinkText(href, filePath, false),
		[app, filePath],
	);

	const handleRowClick = useCallback(
		(e: MouseEvent) => {
			if (wasLongPress()) return;
			if ((e.target as HTMLElement).closest("button")) return;
			if ((e.target as HTMLElement).closest("a")) return;
			if (isSelectionMode) {
				selectionActions.handleToggleSelect(card.id);
			} else if (card.sourceText) {
				cardActions.handleToggleExpand(card.id);
				panelActions.handleJumpToSource(card);
			} else {
				cardActions.handleToggleExpand(card.id);
			}
		},
		[
			isSelectionMode,
			selectionActions,
			cardActions,
			panelActions,
			card,
			wasLongPress,
		],
	);

	const handleMenuClick = useContextMenu([
		{
			title: "Edit",
			icon: "pencil",
			onClick: () => cardActions.handleEditButton(card),
		},
		{
			title: "Copy",
			icon: "copy",
			onClick: () => cardActions.handleCopyCard(card),
		},
		{
			title: "Move",
			icon: "folder-input",
			onClick: () => cardActions.handleMoveCard(card),
		},
		{
			title: "Change type",
			icon: "replace",
			onClick: () => cardActions.handleChangeType(card),
		},
		...(card.cardType !== "cloze" &&
		card.cardType !== "image-occlusion" &&
		card.cardType !== "note-review"
			? ([
					{
						title:
							card.cardType === "reversed"
								? "Remove reversed"
								: "Make reversed",
						icon: "arrow-left-right",
						onClick: () => cardActions.handleToggleReversed(card),
					},
				] as MenuItem[])
			: []),
		{
			title: "Forget",
			icon: "rotate-ccw",
			onClick: () => cardActions.handleForgetCard(card),
		},
		isSuspended(fsrsCard)
			? {
					title: "Unsuspend",
					icon: "play",
					onClick: () => cardActions.handleUnsuspendCard(card),
				}
			: {
					title: "Suspend",
					icon: "pause",
					onClick: () => cardActions.handleSuspendCard(card),
				},
		"separator",
		{
			title: "Delete",
			icon: "trash-2",
			onClick: () => cardActions.handleDeleteCard(card),
		},
		...(!isSelectionMode
			? ([
					"separator",
					{
						title: "Select",
						icon: "check-square",
						onClick: () => selectionActions.handleEnterSelectionMode(card.id),
					},
				] as MenuItem[])
			: []),
	]);

	const handleCheckboxClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			selectionActions.handleToggleSelect(card.id);
		},
		[selectionActions, card.id],
	);

	const title = getStatusTitle(fsrsCard);
	const state = getHighlightColor(fsrsCard);
	const selectedCls = isSelected ? "ep:border-obs-interactive" : "";

	const onHoverSource = card.sourceText
		? () => panelActions.handleHoverSource(card)
		: undefined;
	const onLeaveSource = card.sourceText
		? panelActions.handleLeaveSource
		: undefined;

	return (
		<Clickable
			title={title}
			class={cn(
				panelCardVariants({ state: isSelected ? undefined : state }),
				selectedCls,
				enterClass,
			)}
			style={enterStyle}
			onClick={handleRowClick}
			onContextMenu={isSelectionMode ? undefined : handleMenuClick}
			{...longPressHandlers}
			onMouseEnter={onHoverSource}
			onMouseLeave={onLeaveSource}
		>
			<div class="ep:flex ep:items-start ep:gap-2 ep:p-3 ep:text-left ep:w-full">
				{isSelectionMode && (
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:cursor-pointer"
						checked={isSelected}
						onClick={handleCheckboxClick}
					/>
				)}

				<CardStatusBadge fsrsCard={fsrsCard} />
				<CardTypeBadge card={card} />
				<MarkdownContent
					markdown={
						card.cardType === "note-review"
							? (fsrsCard?.sourceNoteName ?? "Note Review")
							: card.question
					}
					filePath={filePath}
					class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
					onLinkClick={handleLinkClick}
				/>
			</div>

			{isExpanded && (
				<div class="ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border">
					{card.cardType === "note-review" ? (
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							Whole-note review
						</span>
					) : (
						<>
							{!card.answer && (
								<span class="ep:text-ui-smaller ep:text-obs-muted">
									No answer
								</span>
							)}
							<MarkdownContent
								markdown={card.answer ?? "empty"}
								filePath={filePath}
								class="ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field"
								onLinkClick={handleLinkClick}
							/>
						</>
					)}
					{fsrsCard && fsrsCard.fsrs.reps > 0 && (
						<div class="ep:flex ep:items-center ep:gap-3 ep:mt-2 ep:pt-2 ep:border-t ep:border-obs-border/50">
							<span class="ep:text-ui-smaller ep:text-obs-faint">
								{fsrsCard.fsrs.reps} reviews
							</span>
							{fsrsCard.fsrs.stability > 0 && (
								<span class="ep:text-ui-smaller ep:text-obs-faint">
									S: {fsrsCard.fsrs.stability.toFixed(1)}d
								</span>
							)}
							{fsrsCard.fsrs.lapses > 0 && (
								<span class="ep:text-ui-smaller ep:text-obs-faint">
									{fsrsCard.fsrs.lapses} lapses
								</span>
							)}
							{fsrsCard.noteTypeName && (
								<span class="ep:text-ui-smaller ep:text-obs-faint">
									{fsrsCard.noteTypeName}
								</span>
							)}
						</div>
					)}
				</div>
			)}
		</Clickable>
	);
});
