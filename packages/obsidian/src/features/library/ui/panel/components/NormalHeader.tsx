import { SearchInput } from "@true-recall/obsidian/components";
import { PanelIconButton } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIconButton";
import { usePanelHeader } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelHeader";
import type {
	PanelSort,
	PanelStatusFilter,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";

export interface NormalHeaderProps {
	totalCount: number;
	visibleCount: number;
	dueCount: number;
	statusFilter: PanelStatusFilter;
	sort: PanelSort;
	onStatusFilterChange: (filter: PanelStatusFilter) => void;
	onSortChange: (sort: PanelSort) => void;
	onEnterSelection: () => void;
	onSearchInput: (input: HTMLInputElement | null) => void;
	onShowShortcuts: () => void;
	onRefresh: () => void;
}

export function NormalHeader(props: NormalHeaderProps) {
	const {
		totalCount,
		visibleCount,
		dueCount,
		statusFilter,
		sort,
		onEnterSelection,
		onSearchInput,
	} = props;
	const header = usePanelHeader(props);
	const activeFilterCount =
		(statusFilter === "all" ? 0 : 1) + (sort === "source" ? 0 : 1);
	const countLabel =
		visibleCount === totalCount
			? String(totalCount)
			: `${visibleCount} of ${totalCount}`;

	return (
		<header class="ep:flex ep:shrink-0 ep:flex-col ep:gap-2 ep:px-2 ep:pt-2">
			<div class="ep:flex ep:h-7 ep:items-center ep:gap-1">
				<h2 class="ep:min-w-0 ep:flex-1 ep:truncate ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Cards{" "}
					<span class="ep:font-normal ep:text-obs-muted ep:tabular-nums">
						{countLabel}
					</span>
					{dueCount > 0 && !header.rModeEnabled ? (
						<span class="ep:font-normal ep:text-obs-orange">
							{" "}
							· {dueCount} due
						</span>
					) : null}
				</h2>
				<PanelIconButton
					icon="play"
					label="Study This Note"
					disabled={!header.canStudy}
					onClick={header.handleStudy}
				/>
				{header.isFollowingReview ? (
					<PanelIconButton
						icon="file-text"
						label="Open Source Note"
						onClick={header.handleOpenSourceNote}
					/>
				) : null}
				{header.uncollectedCount > 0 ? (
					<PanelIconButton
						icon="download"
						label={`Collect ${header.uncollectedCount} Cards`}
						class="true-recall-pulse-collect"
						onClick={() => void header.handleCollect()}
					/>
				) : null}
				<PanelIconButton
					icon="check-square"
					label="Select Cards (⌘A)"
					disabled={visibleCount === 0}
					onClick={onEnterSelection}
				/>
				<PanelIconButton
					icon="plus"
					label="Add Card (N)"
					onClick={() => void header.handleAddFlashcard()}
				/>
				<PanelIconButton
					icon="more-vertical"
					label="More Actions"
					onClick={header.openMoreMenu}
				/>
			</div>

			<div class="ep:flex ep:items-center ep:gap-1">
				<SearchInput
					value={header.searchQuery}
					placeholder="Search question or answer…"
					ariaLabel="Search Questions and Answers"
					autoComplete="off"
					onChange={header.handleSearchChange}
					onInputElement={onSearchInput}
					disabled={totalCount === 0}
				/>
				<PanelIconButton
					icon="list-filter"
					label={
						activeFilterCount > 0
							? `Filters, ${activeFilterCount} Active`
							: "Filter & Sort"
					}
					pressed={activeFilterCount > 0}
					onClick={header.openFilterMenu}
				/>
			</div>
		</header>
	);
}
