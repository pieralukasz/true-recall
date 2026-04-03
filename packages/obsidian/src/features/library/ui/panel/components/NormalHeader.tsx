import { IconButton, SearchInput } from "@true-recall/obsidian/components";
import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { countByState } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Menu } from "obsidian";
import { useCallback, useMemo } from "preact/hooks";

export interface NormalHeaderProps {
	streamingNewCount: number;
	onRefresh: () => void;
}

export function NormalHeader({
	streamingNewCount,
	onRefresh,
}: NormalHeaderProps) {
	const plugin = usePlugin();
	const {
		flashcardInfo,
		cardsWithFsrs,
		searchQuery,
		isFollowingReview,
		uncollectedCount,
		hasHighlights,
	} = usePanelStore();

	const panelActions = usePanelActions();
	const cardActions = useCardActions();

	const reviewedToday = plugin.sessionPersistence?.getReviewedToday();
	const dayStartHour = plugin.settings.dayStartHour;
	const hasUncollectedFlashcards = uncollectedCount > 0;
	const totalCount =
		(flashcardInfo?.flashcards.length ?? 0) + streamingNewCount;

	const hasNoteReview = useMemo(() => {
		const sourceUid = flashcardInfo?.sourceUid;
		if (!sourceUid) return false;
		return plugin.flashcardManager.hasNoteReview(sourceUid);
	}, [flashcardInfo?.sourceUid, flashcardInfo?.cardCount, plugin]);

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
					.onClick(panelActions.handleOpenSourceNote),
			);

			if (hasHighlights) {
				menu.addItem((item) =>
					item
						.setTitle("Generate from highlights")
						.setIcon("highlighter")
						.onClick(panelActions.handleGenerateFromHighlights),
				);
			}

			if (hasFlashcards) {
				menu.addItem((item) =>
					item
						.setTitle("Browse in card browser")
						.setIcon("table-2")
						.onClick(panelActions.handleBrowseDeck),
				);
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Copy to clipboard")
						.setIcon("clipboard-copy")
						.onClick(panelActions.handleCopyAllToClipboard),
				);
				menu.addItem((item) =>
					item
						.setTitle("Export as CSV")
						.setIcon("file-down")
						.onClick(panelActions.handleExportCsv),
				);
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Forget all flashcards")
						.setIcon("rotate-ccw")
						.onClick(panelActions.handleForgetAll),
				);
				menu.addItem((item) =>
					item
						.setTitle("Delete all flashcards")
						.setIcon("trash-2")
						.onClick(panelActions.handleDeleteAll),
				);
				menu.addItem((item) =>
					item
						.setTitle("Delete note & all flashcards")
						.setIcon("file-x-2")
						.onClick(panelActions.handleDeleteNoteAndCards),
				);
			}

			menu.showAtMouseEvent(e);
		},
		[flashcardInfo, onRefresh, hasHighlights, panelActions],
	);

	const baseCounts =
		cardsWithFsrs.length > 0
			? countByState(cardsWithFsrs, reviewedToday, dayStartHour)
			: null;
	const counts =
		baseCounts || streamingNewCount > 0
			? {
					new: (baseCounts?.new ?? 0) + streamingNewCount,
					learning: baseCounts?.learning ?? 0,
					review: baseCounts?.review ?? 0,
				}
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
							<div class={`${badgeCls} ${FSRS_COLORS.new.badgeCls}`}>
								{counts.new}
							</div>
							<div class={`${badgeCls} ${FSRS_COLORS.learning.badgeCls}`}>
								{counts.learning}
							</div>
							<div class={`${badgeCls} ${FSRS_COLORS.review.badgeCls}`}>
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
							onClick={panelActions.handleOpenSourceNote}
							size="small"
						/>
					)}

					{hasUncollectedFlashcards && (
						<IconButton
							icon="download"
							ariaLabel={`Collect ${uncollectedCount} flashcards`}
							onClick={() => void panelActions.handleCollect()}
							size="small"
							label={String(uncollectedCount)}
							class="true-recall-pulse-collect"
						/>
					)}

					{!isFollowingReview && (
						<IconButton
							icon={hasNoteReview ? "toggle-right" : "toggle-left"}
							ariaLabel={
								hasNoteReview ? "Disable note review" : "Enable note review"
							}
							onClick={() => void plugin.toggleNoteReview()}
							size="small"
							class={hasNoteReview ? "ep:text-obs-accent" : undefined}
						/>
					)}

					{!isFollowingReview && (
						<IconButton
							icon="brain"
							ariaLabel="Start review"
							onClick={() => void panelActions.handleReview()}
							size="small"
							disabled={(flashcardInfo?.cardCount ?? 0) === 0}
						/>
					)}

					<IconButton
						icon="plus"
						ariaLabel="Add flashcard"
						onClick={cardActions.handleAddFlashcard}
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
				onChange={panelActions.handleSearchChange}
				disabled={totalCount === 0}
			/>
		</div>
	);
}
