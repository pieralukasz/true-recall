import { StatusDot } from "@features/library/ui/panel/components/StatusDot";
import {
	getStatusDotColor,
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
	useContextMenu,
	type MenuItem,
} from "@shared/ui/preact/useContextMenu";

import { useCallback, useRef } from "preact/hooks";

export interface CompactCardProps {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
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
}

export function CompactCard({
	card,
	fsrsCard,
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
	onLongPress,
}: CompactCardProps) {
	const app = useApp();
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
		{ title: "Edit", icon: "pencil", onClick: onEdit },
		{ title: "Copy", icon: "copy", onClick: onCopy },
		{ title: "Move", icon: "folder-input", onClick: onMove },
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
					color={getStatusDotColor(fsrsCard)}
					title={getStatusTitle(fsrsCard)}
				/>

				{isSuspended(fsrsCard) && (
					<span
						class="ep:text-ui-smaller ep:text-obs-red ep:font-medium ep:shrink-0"
						title="Suspended - excluded from review"
					>
						S
					</span>
				)}
				{!isSuspended(fsrsCard) && isBuried(fsrsCard) && (
					<span
						class="ep:text-ui-smaller ep:text-obs-faint ep:font-medium ep:shrink-0"
						title={`Buried until ${new Date(fsrsCard?.fsrs.buriedUntil ?? "").toLocaleDateString()}`}
					>
						B
					</span>
				)}

				<MarkdownContent
					markdown={card.question}
					filePath={filePath}
					class="ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown"
					onLinkClick={handleLinkClick}
				/>

				<IconButton
					icon="more-vertical"
					ariaLabel="Card actions"
					onClick={handleMenuClick}
					size="small"
				/>
			</Clickable>

			{isExpanded && (
				<div class="ep:px-3 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border">
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
						</div>
					)}
				</div>
			)}
		</div>
	);
}
