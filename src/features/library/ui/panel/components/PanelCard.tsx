import {
	getHighlightColor,
	getStatusTitle,
	isBuried,
	isSuspended,
} from "@features/library/ui/panel/utils/card-status.utils";
import type { FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { MarkdownContent } from "@shared/ui/components/MarkdownContent";
import { useApp } from "@shared/ui/preact/ObsidianContext";
import {
	type MenuItem,
	useContextMenu,
} from "@shared/ui/preact/useContextMenu";
import { useLongPress } from "@shared/ui/preact/useLongPress";
import { cva } from "class-variance-authority";
import { useCallback } from "preact/hooks";

// ── Variants ────────────────────────────────────────────────

const panelCardVariants = cva(
	"ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border-[1px] ep:border-obs-border/20 ep:shadow-sm ep:hover:bg-obs-modifier-hover ep:transition-colors ep:duration-300",
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
	onToggleExpand: () => void;
	onToggleSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onCopy: () => void;
	onMove: () => void;
	onChangeType: () => void;
	onToggleReversed: () => void;
	onForget: () => void;
	onSelect: () => void;
	onLongPress: () => void;
	onJumpToSource?: () => void;
	onHoverSource?: () => void;
	onLeaveSource?: () => void;
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
	return null;
}

// ── Main component ─────────────────────────────────────────

export function PanelCard(props: PanelCardProps) {
	const {
		card,
		fsrsCard,
		filePath,
		isExpanded,
		isSelected,
		isSelectionMode,
		enterClass,
		enterStyle,
		onToggleExpand,
		onToggleSelect,
		onEdit,
		onDelete,
		onCopy,
		onMove,
		onChangeType,
		onToggleReversed,
		onForget,
		onSelect,
		onLongPress: onLongPressProp,
		onJumpToSource,
		onHoverSource,
		onLeaveSource,
	} = props;

	const app = useApp();

	const { handlers: longPressHandlers, wasLongPress } = useLongPress({
		onLongPress: onLongPressProp,
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
				onToggleSelect();
			} else if (onJumpToSource) {
				onToggleExpand();
				onJumpToSource();
			} else {
				onToggleExpand();
			}
		},
		[
			isSelectionMode,
			onToggleSelect,
			onToggleExpand,
			onJumpToSource,
			wasLongPress,
		],
	);

	const handleMenuClick = useContextMenu([
		{ title: "Edit", icon: "pencil", onClick: onEdit },
		{ title: "Copy", icon: "copy", onClick: onCopy },
		{ title: "Move", icon: "folder-input", onClick: onMove },
		{ title: "Change type", icon: "replace", onClick: onChangeType },
		...(card.cardType !== "cloze" && card.cardType !== "image-occlusion"
			? ([
					{
						title:
							card.cardType === "reversed"
								? "Remove reversed"
								: "Make reversed",
						icon: "arrow-left-right",
						onClick: onToggleReversed,
					},
				] as MenuItem[])
			: []),
		{ title: "Forget", icon: "rotate-ccw", onClick: onForget },
		"separator",
		{ title: "Delete", icon: "trash-2", onClick: onDelete },
		...(!isSelectionMode
			? ([
					"separator",
					{ title: "Select", icon: "check-square", onClick: onSelect },
				] as MenuItem[])
			: []),
	]);

	const handleCheckboxClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			onToggleSelect();
		},
		[onToggleSelect],
	);

	const title = getStatusTitle(fsrsCard);
	const state = getHighlightColor(fsrsCard);
	const selectedCls = isSelected ? "ep:border-obs-interactive" : "";

	return (
		<Clickable
			title={title}
			class={`${panelCardVariants({ state: isSelected ? undefined : state })} ${selectedCls} ${enterClass ?? ""}`}
			style={enterStyle}
			onClick={handleRowClick}
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
					markdown={card.question}
					filePath={filePath}
					class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
					onLinkClick={handleLinkClick}
				/>

				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:gap-1 ep:self-center">
					<IconButton
						icon="more-vertical"
						ariaLabel="Card actions"
						onClick={handleMenuClick}
						size="small"
						class="ep:opacity-30 ep:hover:opacity-100 ep:transition-opacity"
					/>
				</div>
			</div>

			{isExpanded && (
				<div class="ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border">
					{!card.answer && (
						<span class="ep:text-ui-smaller ep:text-obs-muted">No answer</span>
					)}
					<MarkdownContent
						markdown={card.answer ?? "empty"}
						filePath={filePath}
						class="ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field"
						onLinkClick={handleLinkClick}
					/>
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
}
