import { memo } from "preact/compat";
import { useCallback } from "preact/hooks";

import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";
import { stripMarkdownSyntax } from "@true-recall/core/utils";

import { PanelCardMedia } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCardMedia";
import { PanelIconButton } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIconButton";
import { usePanelCardMenu } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelCardMenu";
import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import { getFirstPanelImageRef } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-image.utils";
import {
	getAnswerMatchSnippet,
	getPanelCardStatus,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";
import { useLongPress } from "@true-recall/obsidian/preact/useLongPress";
import { cn } from "@true-recall/obsidian/utils";
import { isMobile } from "@true-recall/obsidian/utils/platform";

interface PanelCardProps {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	isSelected: boolean;
	isSelectionMode: boolean;
	searchQuery: string;
	dayStartHour: number;
	sourcePath: string;
	actions: PanelCardActionHandlers;
}

const STATUS_DOT_CLASSES = {
	danger: "ep:bg-obs-red",
	warning: "ep:bg-obs-orange",
	muted: "ep:bg-obs-muted",
} as const;

export const PanelCard = memo(function PanelCard({
	card,
	fsrsCard,
	isSelected,
	isSelectionMode,
	searchQuery,
	dayStartHour,
	sourcePath,
	actions,
}: PanelCardProps) {
	const { handlers: longPressHandlers, wasLongPress } = useLongPress({
		onLongPress: () => actions.onEnterSelection(card.id),
	});

	const openMenu = usePanelCardMenu({
		card,
		fsrsCard,
		actions,
		variant: "row",
		isSelectionMode,
	});

	const handleOpen = useCallback(
		(event: MouseEvent) => {
			if (wasLongPress()) return;
			if (event.metaKey || event.ctrlKey) {
				actions.onEnterSelection(card.id);
				return;
			}
			actions.onOpen(card);
		},
		[actions, card, wasLongPress],
	);

	const question = stripMarkdownSyntax(card.question)
		.replace(/\s+/g, " ")
		.trim();
	const answerSnippet = searchQuery
		? getAnswerMatchSnippet(card.answer, searchQuery)
		: null;
	const status = getPanelCardStatus(fsrsCard, dayStartHour);
	const hasImage = Boolean(
		fsrsCard?.ioImagePath ??
			getFirstPanelImageRef(card.question, card.answer ?? ""),
	);
	const displayQuestion =
		question || (hasImage ? "Image card" : "Untitled card");

	return (
		<div
			role="group"
			class={cn(
				"tr-panel-card-row ep:group ep:flex ep:items-center ep:min-w-0 ep:border-b ep:border-obs-border/50 ep:hover:bg-obs-modifier-hover",
				isSelected && "ep:bg-obs-interactive/10",
			)}
			onContextMenu={isSelectionMode ? undefined : openMenu}
			onMouseEnter={
				card.sourceText ? () => actions.onHoverSource(card) : undefined
			}
			onMouseLeave={card.sourceText ? actions.onLeaveSource : undefined}
			{...longPressHandlers}
		>
			{isSelectionMode ? (
				<label class="ep:flex ep:flex-1 ep:min-w-0 ep:items-center ep:gap-2.5 ep:px-2.5 ep:py-1 ep:cursor-pointer ep:touch-manipulation">
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:shrink-0 ep:cursor-pointer"
						checked={isSelected}
						onChange={() => actions.onSetSelected([card.id], !isSelected)}
					/>
					<CardRowContent
						question={displayQuestion}
						answerSnippet={answerSnippet}
						status={status}
					/>
					<PanelCardMedia
						card={card}
						fsrsCard={fsrsCard}
						sourcePath={sourcePath}
					/>
				</label>
			) : (
				<>
					<button
						type="button"
						class="tr-panel-card-main ep:flex ep:flex-1 ep:min-w-0 ep:items-center ep:gap-2.5 ep:text-left ep:bg-transparent ep:border-0 ep:cursor-pointer ep:touch-manipulation"
						data-panel-card-id={card.id}
						title={displayQuestion}
						onClick={handleOpen}
					>
						<CardRowContent
							question={displayQuestion}
							answerSnippet={answerSnippet}
							status={status}
						/>
						<PanelCardMedia
							card={card}
							fsrsCard={fsrsCard}
							sourcePath={sourcePath}
						/>
					</button>
					<PanelIconButton
						icon="more-vertical"
						label={`Actions for ${displayQuestion}`}
						class={
							// Touch devices have no hover; keep the menu reachable.
							isMobile()
								? "ep:self-center ep:mr-1 ep:min-h-10 ep:min-w-10"
								: "ep:self-center ep:mr-1 ep:opacity-0 ep:group-hover:opacity-100 ep:group-focus-within:opacity-100"
						}
						onClick={(event) => openMenu(event)}
					/>
				</>
			)}
		</div>
	);
});

function CardRowContent({
	question,
	answerSnippet,
	status,
}: {
	question: string;
	answerSnippet: string | null;
	status: ReturnType<typeof getPanelCardStatus>;
}) {
	return (
		<div class="ep:flex ep:flex-1 ep:min-w-0 ep:items-center ep:gap-2.5">
			<div class="ep:flex ep:flex-1 ep:min-w-0 ep:flex-col ep:gap-0.5">
				<div class="ep:truncate ep:text-ui-small ep:font-medium ep:leading-snug ep:text-obs-normal">
					{question}
				</div>
				{answerSnippet ? (
					<div class="ep:truncate ep:text-ui-smaller ep:leading-snug ep:text-obs-muted">
						{answerSnippet}
					</div>
				) : null}
			</div>
			{status ? (
				<span
					role="img"
					aria-label={status.label}
					title={status.label}
					class={cn(
						"ep:block ep:h-1.5 ep:w-1.5 ep:shrink-0 ep:rounded-full",
						STATUS_DOT_CLASSES[status.tone],
					)}
				/>
			) : null}
		</div>
	);
}
