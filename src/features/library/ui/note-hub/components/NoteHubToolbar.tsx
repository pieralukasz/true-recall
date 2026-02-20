import {
	PILL_ACTIVE,
	PILL_INACTIVE,
	SORT_OPTIONS,
	STATUS_FILTERS,
} from "@features/library/ui/note-hub/constants";
import type {
	NoteHubSortBy,
	NoteHubSortDirection,
	NoteHubStatusFilter,
} from "@shared/store";
import { SearchInput } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact/hooks";

export interface NoteHubToolbarProps {
	searchQuery: string;
	statusFilter: NoteHubStatusFilter;
	sortBy: NoteHubSortBy;
	sortDirection: NoteHubSortDirection;
	onSearchChange: (query: string) => void;
	onStatusFilterChange: (filter: NoteHubStatusFilter) => void;
	onSortByChange: (sortBy: NoteHubSortBy) => void;
	onSortDirectionToggle: () => void;
	onRefresh: () => void;
}

export function NoteHubToolbar({
	searchQuery,
	statusFilter,
	sortBy,
	sortDirection,
	onSearchChange,
	onStatusFilterChange,
	onSortByChange,
	onSortDirectionToggle,
	onRefresh,
}: NoteHubToolbarProps) {
	const sortDirIcon = useIcon(
		sortDirection === "asc" ? "arrow-up" : "arrow-down",
	);
	const refreshIcon = useIcon("refresh-cw");

	return (
		<div class="ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:shrink-0 ep:flex-wrap">
			<SearchInput
				value={searchQuery}
				placeholder="Search notes..."
				onChange={onSearchChange}
			/>

			<div class="ep:flex ep:items-center ep:gap-1">
				{STATUS_FILTERS.map((f) => (
					<button
						type="button"
						key={f.value}
						class={statusFilter === f.value ? PILL_ACTIVE : PILL_INACTIVE}
						onClick={() => onStatusFilterChange(f.value)}
					>
						{f.label}
					</button>
				))}
			</div>

			<div class="ep:flex ep:items-center ep:gap-1">
				<select
					class="ep:bg-obs-primary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-lg ep:px-2 ep:py-1 ep:text-ui-smaller ep:cursor-pointer"
					value={sortBy}
					onChange={(e) =>
						onSortByChange(
							(e.target as HTMLSelectElement).value as NoteHubSortBy,
						)
					}
				>
					{SORT_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>

				<button
					type="button"
					class="clickable-icon"
					aria-label={
						sortDirection === "asc" ? "Sort ascending" : "Sort descending"
					}
					onClick={onSortDirectionToggle}
				>
					<span ref={sortDirIcon} />
				</button>
			</div>

			<button
				type="button"
				class="clickable-icon"
				aria-label="Refresh"
				onClick={onRefresh}
			>
				<span ref={refreshIcon} />
			</button>
		</div>
	);
}
