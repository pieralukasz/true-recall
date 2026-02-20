import { Menu } from "obsidian";
import { useCallback } from "preact/hooks";
import type { FlashcardInfo } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import type { SelectionMode } from "@shared/store";
import { useIcon } from "@shared/ui/preact/hooks";
import { SearchInput } from "@shared/ui/components";
import { countByState } from "@features/study/ui/panel/utils/card-status.utils";

export interface PanelHeaderProps {
	flashcardInfo: FlashcardInfo | null;
	cardsWithFsrs: FSRSFlashcardItem[];
	hasUncollectedFlashcards: boolean;
	uncollectedCount: number;
	selectionMode: SelectionMode;
	selectedCount: number;
	searchQuery: string;
	isFollowingReview: boolean;
	reviewedToday?: Set<string>;
	dayStartHour: number;
	onAdd: () => void;
	onCollect: () => void;
	onRefresh: () => void;
	onReview: () => void;
	onExitSelectionMode: () => void;
	onSearchChange: (query: string) => void;
	onExportCsv: () => void;
	onCopyToClipboard: () => void;
	onDeleteAll: () => void;
	onOpenSourceNote: () => void;
}

export function PanelHeader({
	flashcardInfo,
	cardsWithFsrs,
	hasUncollectedFlashcards,
	uncollectedCount,
	selectionMode,
	selectedCount,
	searchQuery,
	isFollowingReview,
	reviewedToday,
	dayStartHour,
	onAdd,
	onCollect,
	onRefresh,
	onReview,
	onExitSelectionMode,
	onSearchChange,
	onExportCsv,
	onCopyToClipboard,
	onDeleteAll,
	onOpenSourceNote,
}: PanelHeaderProps) {
	const moreIconRef = useIcon("more-vertical");
	const addIconRef = useIcon("plus");
	const collectIconRef = useIcon("download");
	const openNoteIconRef = useIcon("file-text");
	const closeIconRef = useIcon("x");

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

			if (hasFlashcards) {
				menu.addItem((item) =>
					item.setTitle("Start review").setIcon("brain").onClick(onReview),
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
			onReview,
			onCopyToClipboard,
			onExportCsv,
			onDeleteAll,
		],
	);

	if (selectionMode === "selecting") {
		return (
			<div class="ep:flex ep:flex-col ep:gap-2">
				<div class="ep:flex ep:items-center ep:justify-between">
					<div class="ep:flex ep:items-center ep:gap-3">
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{selectedCount} selected
						</div>
					</div>
					<div class="ep:flex ep:items-center ep:gap-1">
						<button
							type="button"
							class="clickable-icon ep:flex ep:items-center ep:gap-1"
							aria-label="Exit selection mode"
							onClick={onExitSelectionMode}
						>
							<span ref={closeIconRef} />
							<span class="ep:text-ui-smaller ep:text-obs-faint">Cancel</span>
						</button>
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
						<button
							type="button"
							class="clickable-icon"
							aria-label="Open source note"
							onClick={onOpenSourceNote}
						>
							<span ref={openNoteIconRef} />
						</button>
					)}

					{hasUncollectedFlashcards && (
						<button
							type="button"
							class="clickable-icon ep:flex ep:items-center ep:gap-1 true-recall-pulse-collect"
							aria-label={`Collect ${uncollectedCount} flashcards`}
							onClick={onCollect}
						>
							<span ref={collectIconRef} />
							<span class="ep:text-ui-smaller">{uncollectedCount}</span>
						</button>
					)}

					<button
						type="button"
						class="clickable-icon"
						aria-label="Add flashcard"
						onClick={onAdd}
					>
						<span ref={addIconRef} />
					</button>

					<button
						type="button"
						class="clickable-icon"
						aria-label="More actions"
						onClick={handleMoreMenu}
					>
						<span ref={moreIconRef} />
					</button>
				</div>
			</div>

			<SearchInput
				value={searchQuery}
				placeholder="Search flashcards..."
				onChange={onSearchChange}
			/>
		</div>
	);
}
