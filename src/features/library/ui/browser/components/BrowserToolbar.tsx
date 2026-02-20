import type { BrowserStateFilter } from "@shared/store";
import {
	IconButton,
	SearchInput,
} from "@shared/ui/components";

const STATE_FILTERS: { value: BrowserStateFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "new", label: "New" },
	{ value: "learning", label: "Learning" },
	{ value: "review", label: "Review" },
	{ value: "relearning", label: "Relearn" },
	{ value: "suspended", label: "Suspended" },
	{ value: "buried", label: "Buried" },
];

const PILL_BASE =
	"ep:px-2 ep:py-0.5 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";
const PILL_ACTIVE = `${PILL_BASE} ep:bg-obs-interactive ep:text-obs-on-accent`;
const PILL_INACTIVE = `${PILL_BASE} ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal`;

export interface BrowserToolbarProps {
	searchQuery: string;
	stateFilter: BrowserStateFilter;
	totalCount: number;
	filteredCount: number;
	onSearchChange: (query: string) => void;
	onStateFilterChange: (filter: BrowserStateFilter) => void;
	onRefresh: () => void;
}

export function BrowserToolbar({
	searchQuery,
	stateFilter,
	totalCount,
	filteredCount,
	onSearchChange,
	onStateFilterChange,
	onRefresh,
}: BrowserToolbarProps) {
	const countText =
		filteredCount === totalCount
			? `${totalCount} cards`
			: `${filteredCount} of ${totalCount} cards`;

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border-b ep:border-obs-border">
			<div class="ep:flex ep:items-center ep:gap-2">
				<SearchInput
					value={searchQuery}
					placeholder="Search cards\u2026"
					onChange={onSearchChange}
					class="ep:flex-1"
				/>
				<IconButton icon="refresh-cw" ariaLabel="Refresh" onClick={onRefresh} />
			</div>
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-2 ep:flex-wrap">
				<div class="ep:flex ep:items-center ep:gap-1 ep:flex-wrap">
					{STATE_FILTERS.map((f) => (
						<button
							type="button"
							key={f.value}
							class={stateFilter === f.value ? PILL_ACTIVE : PILL_INACTIVE}
							onClick={() => onStateFilterChange(f.value)}
						>
							{f.label}
						</button>
					))}
				</div>
				<span
					class="ep:text-ui-smaller ep:text-obs-muted ep:whitespace-nowrap"
					aria-live="polite"
				>
					{countText}
				</span>
			</div>
		</div>
	);
}
