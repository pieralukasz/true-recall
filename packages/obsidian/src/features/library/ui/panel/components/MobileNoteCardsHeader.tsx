import { useState } from "preact/hooks";

import { Clickable, SearchInput } from "@true-recall/obsidian/components";
import type { NormalHeaderProps } from "@true-recall/obsidian/features/library/ui/panel/components/NormalHeader";
import { PanelIconButton } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIconButton";
import { usePanelHeader } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelHeader";

export interface MobileNoteCardsHeaderProps extends NormalHeaderProps {
	noteName: string | null;
}

/**
 * Touch-first header for the current-note cards view on phones: note name
 * with card counts, a prominent Review button, Add, and a collapsible
 * search row. The desktop NormalHeader packs everything into one dense
 * icon row, which is unusable at finger sizes.
 */
export function MobileNoteCardsHeader(props: MobileNoteCardsHeaderProps) {
	const { noteName, totalCount, visibleCount, dueCount, statusFilter, sort } =
		props;
	const header = usePanelHeader(props);
	const [isSearchOpen, setIsSearchOpen] = useState(false);

	const activeFilterCount =
		(statusFilter === "all" ? 0 : 1) + (sort === "source" ? 0 : 1);
	const countLabel =
		visibleCount === totalCount
			? String(totalCount)
			: `${visibleCount} of ${totalCount}`;

	return (
		<header class="ep:flex ep:shrink-0 ep:flex-col ep:gap-2 ep:px-2 ep:pt-2">
			<div class="ep:flex ep:items-baseline ep:gap-2 ep:min-w-0">
				<h2 class="ep:min-w-0 ep:flex-1 ep:truncate ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					{noteName ?? "No note selected"}
				</h2>
				<span class="ep:shrink-0 ep:text-ui-smaller ep:text-obs-muted ep:tabular-nums">
					{countLabel}
					{dueCount > 0 && !header.rModeEnabled ? (
						<span class="ep:text-obs-orange"> · {dueCount} due</span>
					) : null}
				</span>
			</div>

			<div class="ep:flex ep:items-center ep:gap-1.5">
				<Clickable
					class={`ep:flex ep:flex-1 ep:items-center ep:justify-center ep:gap-1.5 ep:min-h-10 ep:rounded-md ep:border-none ep:cursor-pointer ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-small ep:font-medium ${
						header.canStudy ? "" : "ep:opacity-50"
					}`}
					disabled={!header.canStudy}
					onClick={header.handleStudy}
				>
					Review
				</Clickable>
				<Clickable
					class="ep:flex ep:items-center ep:justify-center ep:gap-1 ep:min-h-10 ep:px-4 ep:rounded-md ep:border-none ep:cursor-pointer ep:bg-obs-border/50 ep:text-obs-normal ep:text-ui-small ep:font-medium"
					onClick={() => void header.handleAddFlashcard()}
				>
					+ Add
				</Clickable>
				{header.uncollectedCount > 0 ? (
					<PanelIconButton
						icon="download"
						label={`Collect ${header.uncollectedCount} Cards`}
						class="true-recall-pulse-collect ep:min-h-10 ep:min-w-10"
						onClick={() => void header.handleCollect()}
					/>
				) : null}
				<PanelIconButton
					icon="search"
					label="Search Cards"
					pressed={isSearchOpen}
					disabled={totalCount === 0}
					class="ep:min-h-10 ep:min-w-10"
					onClick={() => setIsSearchOpen((open) => !open)}
				/>
				<PanelIconButton
					icon="list-filter"
					label={
						activeFilterCount > 0
							? `Filters, ${activeFilterCount} Active`
							: "Filter & Sort"
					}
					pressed={activeFilterCount > 0}
					class="ep:min-h-10 ep:min-w-10"
					onClick={header.openFilterMenu}
				/>
				<PanelIconButton
					icon="more-vertical"
					label="More Actions"
					class="ep:min-h-10 ep:min-w-10"
					onClick={header.openMoreMenu}
				/>
			</div>

			{isSearchOpen ? (
				<SearchInput
					value={header.searchQuery}
					placeholder="Search question or answer…"
					ariaLabel="Search Questions and Answers"
					autoComplete="off"
					onChange={header.handleSearchChange}
					onInputElement={props.onSearchInput}
					disabled={totalCount === 0}
				/>
			) : null}
		</header>
	);
}
