import { countByState } from "@features/library/ui/panel/utils/card-status.utils";
import type { SelectionMode } from "@shared/store";
import type { FlashcardInfo } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { IconButton, SearchInput } from "@shared/ui/components";
import { Menu } from "obsidian";
import { useCallback } from "preact/hooks";

export interface PanelHeaderProps {
	flashcardInfo: FlashcardInfo | null;
	cardsWithFsrs: FSRSFlashcardItem[];
	hasUncollectedFlashcards: boolean;
	uncollectedCount: number;
	selectionMode: SelectionMode;
	selectedCount: number;
	totalCount: number;
	searchQuery: string;
	isFollowingReview: boolean;
	reviewedToday?: Set<string>;
	dayStartHour: number;
	onAdd: () => void;
	onCollect: () => void;
	onRefresh: () => void;
	onReview: () => void;
	onExitSelectionMode: () => void;
	onSelectAll: () => void;
	onMoveSelected: () => void;
	onChangeNoteType: () => void;
	onDeleteSelected: () => void;
	onSearchChange: (query: string) => void;
	onExportCsv: () => void;
	onCopyToClipboard: () => void;
	onDeleteAll: () => void;
	onOpenSourceNote: () => void;
	hasHighlights: boolean;
	onGenerateFromHighlights: () => void;
	onBrowseDeck: () => void;
}

export function PanelHeader({
	flashcardInfo,
	cardsWithFsrs,
	hasUncollectedFlashcards,
	uncollectedCount,
	selectionMode,
	selectedCount,
	totalCount,
	searchQuery,
	isFollowingReview,
	reviewedToday,
	dayStartHour,
	onAdd,
	onCollect,
	onRefresh,
	onReview,
	onExitSelectionMode,
	onSelectAll,
	onMoveSelected,
	onChangeNoteType,
	onDeleteSelected,
	onSearchChange,
	onExportCsv,
	onCopyToClipboard,
	onDeleteAll,
	onOpenSourceNote,
	hasHighlights,
	onGenerateFromHighlights,
	onBrowseDeck,
}: PanelHeaderProps) {
	const handleMoreMenu = useCallback(
		(e: MouseEvent) => {
			const menu = new Menu();
			const hasFlashcards = (flashcardInfo?.cardCount ?? 0) > 0;

			menu.addItem((item) =>
				item.setTitle("Refresh").setIcon("refresh-cw").onClick(onRefresh),
			);
			menu.addItem((item) =>
				item
					.setTitle("Open source note")
					.setIcon("file-text")
					.onClick(onOpenSourceNote),
			);

			if (hasHighlights) {
				menu.addItem((item) =>
					item
						.setTitle("Generate from highlights")
						.setIcon("highlighter")
						.onClick(onGenerateFromHighlights),
				);
			}

			if (hasFlashcards) {
				menu.addItem((item) =>
					item.setTitle("Start review").setIcon("brain").onClick(onReview),
				);
				menu.addItem((item) =>
					item
						.setTitle("Browse in card browser")
						.setIcon("table-2")
						.onClick(onBrowseDeck),
				);
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Copy to clipboard")
						.setIcon("clipboard-copy")
						.onClick(onCopyToClipboard),
				);
				menu.addItem((item) =>
					item
						.setTitle("Export as CSV")
						.setIcon("file-down")
						.onClick(onExportCsv),
				);
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Delete all flashcards")
						.setIcon("trash-2")
						.onClick(onDeleteAll),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[
			flashcardInfo,
			onRefresh,
			onOpenSourceNote,
			hasHighlights,
			onGenerateFromHighlights,
			onReview,
			onBrowseDeck,
			onCopyToClipboard,
			onExportCsv,
			onDeleteAll,
		],
	);

	if (selectionMode === "selecting") {
		const allSelected = selectedCount === totalCount && totalCount > 0;
		const hasSelection = selectedCount > 0;

		return (
			<div class="ep:flex ep:flex-col ep:gap-2">
				<div class="ep:flex ep:items-center ep:justify-between">
					<div class="ep:flex ep:items-center ep:gap-2">
						<IconButton
							icon="x"
							ariaLabel="Exit selection mode"
							onClick={() => onExitSelectionMode()}
							size="small"
						/>
						<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{selectedCount} selected
						</span>
					</div>
					<div class="ep:flex ep:items-center ep:gap-1">
						{!allSelected && (
							<IconButton
								icon="check-square"
								ariaLabel="Select all"
								onClick={onSelectAll}
								size="small"
							/>
						)}
						<IconButton
							icon="folder-input"
							ariaLabel="Move selected"
							onClick={onMoveSelected}
							size="small"
							disabled={!hasSelection}
						/>
						<IconButton
							icon="replace"
							ariaLabel="Change note type"
							onClick={onChangeNoteType}
							size="small"
							disabled={!hasSelection}
						/>
						<IconButton
							icon="trash-2"
							ariaLabel="Delete selected"
							onClick={onDeleteSelected}
							size="small"
							danger
							disabled={!hasSelection}
						/>
					</div>
				</div>
			</div>
		);
	}

	const counts =
		cardsWithFsrs.length > 0
			? countByState(cardsWithFsrs, reviewedToday, dayStartHour)
			: null;

	const badgeCls =
		"ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold";

	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<div class="ep:flex ep:items-center ep:justify-between">
				{/* Left side: section label + counts */}
				<div class="ep:flex ep:items-center ep:gap-3">
					<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
						Cards
					</div>

					{counts && (
						<div class="ep:flex ep:items-center ep:gap-1">
							<div class={`${badgeCls} ep:bg-obs-green/20 ep:text-obs-green`}>
								{counts.new}
							</div>
							<div class={`${badgeCls} ep:bg-obs-orange/20 ep:text-obs-orange`}>
								{counts.learning}
							</div>
							<div class={`${badgeCls} ep:bg-obs-blue/20 ep:text-obs-blue`}>
								{counts.review}
							</div>
						</div>
					)}
				</div>

				{/* Right side: action buttons */}
				<div class="ep:flex ep:items-center ep:gap-1">
					{isFollowingReview && (
						<IconButton
							icon="file-text"
							ariaLabel="Open source note"
							onClick={() => onOpenSourceNote()}
							size="small"
						/>
					)}

					{hasUncollectedFlashcards && (
						<IconButton
							icon="download"
							ariaLabel={`Collect ${uncollectedCount} flashcards`}
							onClick={() => onCollect()}
							size="small"
							label={String(uncollectedCount)}
							class="true-recall-pulse-collect"
						/>
					)}

					<IconButton
						icon="plus"
						ariaLabel="Add flashcard"
						onClick={() => onAdd()}
						size="small"
					/>

					<IconButton
						icon="more-vertical"
						ariaLabel="More actions"
						onClick={handleMoreMenu}
						size="small"
					/>
				</div>
			</div>

			<SearchInput
				value={searchQuery}
				placeholder="Search flashcards..."
				ariaLabel="Search flashcards"
				onChange={onSearchChange}
				disabled={totalCount === 0}
			/>
		</div>
	);
}
