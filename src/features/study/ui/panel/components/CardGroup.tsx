import { StatusDot } from "@features/study/ui/panel/components/StatusDot";
import {
	getAggregateStatusDotColor,
	getAggregateStatusTitle,
	getStatusDotColor,
	getStatusTitle,
} from "@features/study/ui/panel/utils/card-status.utils";
import type { FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { MarkdownContent } from "@shared/ui/components/MarkdownContent";
import { useIcon } from "@shared/ui/preact/hooks";
import { useApp } from "@shared/ui/preact/ObsidianContext";
import { Menu } from "obsidian";
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
	const _app = useApp();
	const menuIconRef = useIcon("more-vertical");
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
			e.stopPropagation();
			if (isSelectionMode) {
				onToggleSelect();
			} else {
				onToggleExpand();
			}
		},
		[isSelectionMode, onToggleSelect, onToggleExpand],
	);

	const handleMenuClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			const menu = new Menu();

			menu.addItem((item) =>
				item.setTitle("Edit group").setIcon("pencil").onClick(onEditGroup),
			);
			menu.addItem((item) =>
				item.setTitle("Copy").setIcon("copy").onClick(onCopyGroup),
			);
			menu.addItem((item) =>
				item.setTitle("Move").setIcon("folder-input").onClick(onMoveGroup),
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle("Delete group").setIcon("trash-2").onClick(onDeleteGroup),
			);

			if (!isSelectionMode) {
				menu.addSeparator();
				menu.addItem((item) =>
					item.setTitle("Select").setIcon("check-square").onClick(onSelect),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[
			onEditGroup,
			onCopyGroup,
			onMoveGroup,
			onDeleteGroup,
			onSelect,
			isSelectionMode,
		],
	);

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
			{/* Header row */}
			<button
				type="button"
				class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-md ep:transition-colors ep:bg-transparent ep:border-none ep:font-inherit ep:text-left ep:w-full"
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

				<div class="ep:flex-1 ep:text-ui-small ep:text-obs-normal ep:truncate">
					{displayText}
				</div>

				<span class="ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-base-25 ep:rounded ep:px-2 ep:py-1 ep:shrink-0">
					{cards.length}
				</span>

				<button
					type="button"
					class="clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5"
					aria-label="Group actions"
					onClick={handleMenuClick}
				>
					<span ref={menuIconRef} />
				</button>
			</button>

			{/* Expanded content */}
			{isExpanded && (
				<div class="ep:border-t ep:border-obs-border">
					{cards.map((card, i) => (
						<div
							key={card.id}
							class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:border-b ep:border-obs-border last:ep:border-b-0"
						>
							<StatusDot
								color={getStatusDotColor(fsrsCards[i])}
								title={getStatusTitle(fsrsCards[i])}
							/>

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
								/>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
