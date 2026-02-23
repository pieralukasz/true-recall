import {
	getAggregateHighlightColor,
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
import { StateBadge } from "@shared/ui/components/StateBadge";
import { useIcon } from "@shared/ui/preact/hooks";
import { useApp } from "@shared/ui/preact/ObsidianContext";
import {
	type MenuItem,
	useContextMenu,
} from "@shared/ui/preact/useContextMenu";
import { useLongPress } from "@shared/ui/preact/useLongPress";
import { cva } from "class-variance-authority";
import type { RefObject } from "preact";
import { useCallback, useMemo } from "preact/hooks";

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

interface PanelCardBase {
	filePath: string;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	onToggleExpand: () => void;
	onToggleSelect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onCopy: () => void;
	onMove: () => void;
	onSelect: () => void;
	onLongPress: () => void;
	onJumpToSource?: () => void;
	onHoverSource?: () => void;
	onLeaveSource?: () => void;
}

export type PanelCardProps = PanelCardBase &
	(
		| {
				variant: "basic";
				card: FlashcardItem;
				fsrsCard?: FSRSFlashcardItem;
		  }
		| {
				variant: "group";
				groupType: "cloze" | "reverse";
				cards: FlashcardItem[];
				fsrsCards: (FSRSFlashcardItem | undefined)[];
				template?: string;
		  }
	);

// ── File-local sub-components ──────────────────────────────

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

function BasicHeader({
	card,
	fsrsCard,
	filePath,
	onLinkClick,
}: {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	filePath: string;
	onLinkClick: (href: string) => void;
}) {
	return (
		<>
			<CardStatusBadge fsrsCard={fsrsCard} />
			<MarkdownContent
				markdown={card.question}
				filePath={filePath}
				class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
				onLinkClick={onLinkClick}
			/>
		</>
	);
}

function GroupHeader({
	displayText,
	filePath,
	cardCount,
	typeIconRef,
	onLinkClick,
}: {
	displayText: string;
	filePath: string;
	cardCount: number;
	typeIconRef: RefObject<HTMLSpanElement>;
	onLinkClick: (href: string) => void;
}) {
	return (
		<>
			<span ref={typeIconRef} class="ep:shrink-0 ep:mt-0.5 ep:text-obs-faint" />
			<MarkdownContent
				markdown={displayText}
				filePath={filePath}
				class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown ep:truncate"
				onLinkClick={onLinkClick}
			/>
			<span class="ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-base-25 ep:rounded ep:px-2 ep:py-1 ep:shrink-0">
				{cardCount}
			</span>
		</>
	);
}

function BasicExpandedContent({
	card,
	fsrsCard,
	filePath,
	onLinkClick,
}: {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	filePath: string;
	onLinkClick: (href: string) => void;
}) {
	return (
		<div class="ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border">
			{!card.answer && (
				<span class="ep:text-ui-smaller ep:text-obs-muted">No answer</span>
			)}
			<MarkdownContent
				markdown={card.answer ?? "empty"}
				filePath={filePath}
				class="ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field"
				onLinkClick={onLinkClick}
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
				</div>
			)}
		</div>
	);
}

function GroupExpandedContent({
	cards,
	fsrsCards,
	groupType,
	filePath,
	onLinkClick,
}: {
	cards: FlashcardItem[];
	fsrsCards: (FSRSFlashcardItem | undefined)[];
	groupType: "cloze" | "reverse";
	filePath: string;
	onLinkClick: (href: string) => void;
}) {
	return (
		<div class="ep:border-t ep:border-obs-border">
			{cards.map((card, i) => {
				const fsrs = fsrsCards[i];
				return (
					<div
						key={card.id}
						class="ep:flex ep:items-start ep:gap-2 ep:px-3 ep:py-2 ep:border-b ep:border-obs-border last:ep:border-b-0"
					>
						{fsrs ? (
							<StateBadge
								state={fsrs.fsrs.state}
								suspended={fsrs.fsrs.suspended}
								buriedUntil={fsrs.fsrs.buriedUntil}
							/>
						) : (
							<span class="ep:text-ui-smaller ep:text-obs-faint">—</span>
						)}
						<div class="ep:flex-1 ep:flex ep:flex-col ep:gap-1">
							<span class="ep:text-xs ep:text-obs-faint ep:uppercase ep:tracking-wider">
								{groupType === "cloze"
									? `Cloze ${card.clozeIndex}`
									: i === 0
										? "Original"
										: "Reversed"}
							</span>
							<MarkdownContent
								markdown={card.question}
								filePath={filePath}
								class="ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
								onLinkClick={onLinkClick}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── Main component ─────────────────────────────────────────

export function PanelCard(props: PanelCardProps) {
	const {
		filePath,
		isExpanded,
		isSelected,
		isSelectionMode,
		onToggleExpand,
		onToggleSelect,
		onEdit,
		onDelete,
		onCopy,
		onMove,
		onSelect,
		onLongPress: onLongPressProp,
		onJumpToSource,
		onHoverSource,
		onLeaveSource,
	} = props;

	const app = useApp();
	const isGroup = props.variant === "group";

	const typeIconRef = useIcon(
		isGroup
			? props.groupType === "cloze"
				? "brackets"
				: "arrow-left-right"
			: "file-text",
	);

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
		{
			title: isGroup ? "Edit group" : "Edit",
			icon: "pencil",
			onClick: onEdit,
		},
		{ title: "Copy", icon: "copy", onClick: onCopy },
		{ title: "Move", icon: "folder-input", onClick: onMove },
		"separator",
		{
			title: isGroup ? "Delete group" : "Delete",
			icon: "trash-2",
			onClick: onDelete,
		},
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

	const title = isGroup ? undefined : getStatusTitle(props.fsrsCard);
	const state = isGroup
		? getAggregateHighlightColor(props.fsrsCards)
		: getHighlightColor(props.fsrsCard);
	const selectedCls = isSelected ? "ep:border-obs-interactive" : "";

	const displayText = useMemo(() => {
		if (props.variant !== "group") return "";
		if (props.groupType === "cloze" && props.template) {
			return props.template.replace(
				/\{\{c\d+::([^}]*?)(?:::[^}]*?)?\}\}/g,
				"$1",
			);
		}
		return props.cards[0]?.question ?? "";
	}, [
		props.variant,
		props.variant === "group" ? props.groupType : undefined,
		props.variant === "group" ? props.template : undefined,
		props.variant === "group" ? props.cards : undefined,
	]);

	return (
		<Clickable
			title={title}
			class={`${panelCardVariants({ state: isSelected ? undefined : state })} ${selectedCls}`}
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

				{props.variant === "group" ? (
					<GroupHeader
						displayText={displayText}
						filePath={filePath}
						cardCount={props.cards.length}
						typeIconRef={typeIconRef}
						onLinkClick={handleLinkClick}
					/>
				) : (
					<BasicHeader
						card={props.card}
						fsrsCard={props.fsrsCard}
						filePath={filePath}
						onLinkClick={handleLinkClick}
					/>
				)}

				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:gap-1 ep:self-center">
					<IconButton
						icon="more-vertical"
						ariaLabel={isGroup ? "Group actions" : "Card actions"}
						onClick={handleMenuClick}
						size="small"
						class="ep:opacity-30 ep:hover:opacity-100 ep:transition-opacity"
					/>
				</div>
			</div>

			{isExpanded &&
				(props.variant === "group" ? (
					<GroupExpandedContent
						cards={props.cards}
						fsrsCards={props.fsrsCards}
						groupType={props.groupType}
						filePath={filePath}
						onLinkClick={handleLinkClick}
					/>
				) : (
					<BasicExpandedContent
						card={props.card}
						fsrsCard={props.fsrsCard}
						filePath={filePath}
						onLinkClick={handleLinkClick}
					/>
				))}
		</Clickable>
	);
}
