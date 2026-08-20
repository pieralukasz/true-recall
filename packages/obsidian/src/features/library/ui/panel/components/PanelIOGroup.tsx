import { memo } from "preact/compat";

import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";
import { stripMarkdownSyntax } from "@true-recall/core/utils";

import { PanelCardMedia } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCardMedia";
import { PanelIconButton } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIconButton";
import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import {
	type MenuItem,
	useContextMenu,
} from "@true-recall/obsidian/preact/useContextMenu";
import { useLongPress } from "@true-recall/obsidian/preact/useLongPress";
import { cn } from "@true-recall/obsidian/utils";

interface PanelIOGroupProps {
	cards: FlashcardItem[];
	fsrsCards: FSRSFlashcardItem[];
	selectedCount: number;
	isSelectionMode: boolean;
	actions: PanelCardActionHandlers;
	sourcePath: string;
}

export const PanelIOGroup = memo(function PanelIOGroup({
	cards,
	fsrsCards,
	selectedCount,
	isSelectionMode,
	actions,
	sourcePath,
}: PanelIOGroupProps) {
	const firstCard = cards[0];
	if (!firstCard) return null;

	const cardIds = cards.map((card) => card.id);
	const allSelected = selectedCount === cardIds.length;
	const someSelected = selectedCount > 0;
	const question =
		stripMarkdownSyntax(firstCard.question).replace(/\s+/g, " ").trim() ||
		"Image occlusion";
	const countLabel = `${cards.length} ${cards.length === 1 ? "card" : "cards"}`;

	const { handlers: longPressHandlers, wasLongPress } = useLongPress({
		onLongPress: () => {
			actions.onEnterSelection(firstCard.id);
			actions.onSetSelected(cardIds, true);
		},
	});

	const menuItems: MenuItem[] = [
		{
			title: "Open Card",
			icon: "panel-right-open",
			onClick: () => actions.onOpen(firstCard),
		},
		{
			title: "Edit Occlusion",
			icon: "pencil",
			onClick: () => actions.onEdit(firstCard),
		},
		{
			title: "Move",
			icon: "folder-input",
			onClick: () => actions.onMove(firstCard),
		},
		"separator",
		{
			title: `Select ${countLabel}`,
			icon: "check-square",
			onClick: () => {
				actions.onEnterSelection(firstCard.id);
				actions.onSetSelected(cardIds, true);
			},
		},
	];
	const openMenu = useContextMenu(menuItems);

	return (
		<div
			role="group"
			class={cn(
				"tr-panel-card-row ep:group ep:flex ep:items-center ep:min-w-0 ep:border-b ep:border-obs-border/50 ep:hover:bg-obs-modifier-hover",
				someSelected && "ep:bg-obs-interactive/10",
			)}
			onContextMenu={isSelectionMode ? undefined : openMenu}
			{...longPressHandlers}
		>
			{isSelectionMode ? (
				<label class="ep:flex ep:flex-1 ep:min-w-0 ep:items-center ep:gap-2.5 ep:px-2.5 ep:py-1 ep:cursor-pointer ep:touch-manipulation">
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:shrink-0 ep:cursor-pointer"
						checked={allSelected}
						ref={(input) => {
							if (input) input.indeterminate = someSelected && !allSelected;
						}}
						onChange={() => actions.onSetSelected(cardIds, !allSelected)}
					/>
					<GroupContent question={question} countLabel={countLabel} />
					<PanelCardMedia
						card={firstCard}
						fsrsCard={fsrsCards[0]}
						sourcePath={sourcePath}
					/>
				</label>
			) : (
				<>
					<button
						type="button"
						class="tr-panel-card-main ep:flex ep:flex-1 ep:min-w-0 ep:items-center ep:gap-2.5 ep:text-left ep:bg-transparent ep:border-0 ep:cursor-pointer ep:touch-manipulation"
						data-panel-card-id={firstCard.id}
						title={question}
						onClick={(event) => {
							if (wasLongPress()) return;
							if (event.metaKey || event.ctrlKey) {
								actions.onEnterSelection(firstCard.id);
								actions.onSetSelected(cardIds, true);
								return;
							}
							actions.onOpen(firstCard);
						}}
					>
						<GroupContent question={question} countLabel={countLabel} />
						<PanelCardMedia
							card={firstCard}
							fsrsCard={fsrsCards[0]}
							sourcePath={sourcePath}
						/>
					</button>
					<PanelIconButton
						icon="more-vertical"
						label={`Actions for ${question}`}
						class="ep:self-center ep:mr-1 ep:opacity-0 ep:group-hover:opacity-100 ep:group-focus-within:opacity-100"
						onClick={(event) => openMenu(event)}
					/>
				</>
			)}
		</div>
	);
});

function GroupContent({
	question,
	countLabel,
}: {
	question: string;
	countLabel: string;
}) {
	return (
		<div class="ep:flex ep:flex-1 ep:min-w-0 ep:items-center ep:gap-2.5">
			<div class="ep:flex-1 ep:min-w-0 ep:truncate ep:text-ui-small ep:font-medium ep:leading-snug ep:text-obs-normal">
				{question}
			</div>
			<div class="ep:shrink-0 ep:text-ui-smaller ep:text-obs-muted">
				{countLabel}
			</div>
		</div>
	);
}
