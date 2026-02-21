import { StatusDot } from "@features/library/ui/panel/components/StatusDot";
import {
	getAggregateStatusDotColor,
	getAggregateStatusTitle,
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
	useContextMenu,
	type MenuItem,
} from "@shared/ui/preact/useContextMenu";
import { useCallback, useMemo, useRef } from "preact/hooks";

export interface CardGroupProps {
	groupType: "cloze" | "reverse";
	cards: FlashcardItem[];
	fsrsCards: (FSRSFlashcardItem | undefined)[];
	template?: string;
	filePath: string;
	groupId: string;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	onToggleExpand: () => void;
	onToggleSelect: () => void;
	onEditGroup: () => void;
	onDeleteGroup: () => void;
	onCopyGroup: () => void;
	onMoveGroup: () => void;
	onSelect: () => void;
	onLongPress: () => void;
}

export function CardGroup({
	groupType,
	cards,
	fsrsCards,
	template,
	filePath,
	isExpanded,
	isSelected,
	isSelectionMode,
	onToggleExpand,
	onToggleSelect,
	onEditGroup,
	onDeleteGroup,
	onCopyGroup,
	onMoveGroup,
	onSelect,
	onLongPress,
}: CardGroupProps) {
	const app = useApp();
	const typeIconRef = useIcon(
		groupType === "cloze" ? "brackets" : "arrow-left-right",
	);
	const longPressRef = useRef<{
		timer: ReturnType<typeof setTimeout> | null;
		wasLongPress: boolean;
	}>({
		timer: null,
		wasLongPress: false,
	});

	const handleLinkClick = useCallback(
		(href: string) => void app.workspace.openLinkText(href, filePath, false),
		[app, filePath],
	);

	const handlePointerDown = useCallback(() => {
		const lp = longPressRef.current;
		lp.wasLongPress = false;
		lp.timer = setTimeout(() => {
			lp.wasLongPress = true;
			lp.timer = null;
			onLongPress();
		}, 500);
	}, [onLongPress]);

	const handlePointerUp = useCallback(() => {
		const lp = longPressRef.current;
		if (lp.timer) {
			clearTimeout(lp.timer);
			lp.timer = null;
		}
	}, []);

	const handlePointerCancel = handlePointerUp;

	const handleRowClick = useCallback(
		(e: MouseEvent) => {
			if (longPressRef.current.wasLongPress) return;
			if ((e.target as HTMLElement).closest("button")) return;
			if ((e.target as HTMLElement).closest("a")) return;
			if (isSelectionMode) {
				onToggleSelect();
			} else {
				onToggleExpand();
			}
		},
		[isSelectionMode, onToggleSelect, onToggleExpand],
	);

	const handleMenuClick = useContextMenu([
		{ title: "Edit group", icon: "pencil", onClick: onEditGroup },
		{ title: "Copy", icon: "copy", onClick: onCopyGroup },
		{ title: "Move", icon: "folder-input", onClick: onMoveGroup },
		"separator",
		{ title: "Delete group", icon: "trash-2", onClick: onDeleteGroup },
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

	const displayText = useMemo(() => {
		if (groupType === "cloze" && template) {
			return template.replace(/\{\{c\d+::([^}]*?)(?:::[^}]*?)?\}\}/g, "$1");
		}
		return cards[0]?.question ?? "";
	}, [groupType, template, cards]);

	const borderCls = isSelected ? "ep:border-obs-interactive ep:border-2" : "";

	return (
		<div
			class={`ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border ep:shadow-sm ${borderCls}`}
		>
			<Clickable
				class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:hover:bg-obs-modifier-hover ep:rounded-md ep:transition-colors ep:text-left ep:w-full"
				onClick={handleRowClick}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
			>
				{isSelectionMode && (
					<input
						type="checkbox"
						class="ep:w-4 ep:h-4 ep:cursor-pointer"
						checked={isSelected}
						onClick={handleCheckboxClick}
					/>
				)}

				<StatusDot
					color={getAggregateStatusDotColor(fsrsCards)}
					title={getAggregateStatusTitle(fsrsCards)}
				/>

				<span
					ref={typeIconRef}
					class="ep:shrink-0 ep:mt-0.5 ep:text-obs-faint"
				/>

				<MarkdownContent
					markdown={displayText}
					filePath={filePath}
					class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown ep:truncate"
					onLinkClick={handleLinkClick}
				/>

				<span class="ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-base-25 ep:rounded ep:px-2 ep:py-1 ep:shrink-0">
					{cards.length}
				</span>

				<IconButton
					icon="more-vertical"
					ariaLabel="Group actions"
					onClick={handleMenuClick}
					size="small"
				/>
			</Clickable>

			{isExpanded && (
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
										onLinkClick={handleLinkClick}
									/>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
