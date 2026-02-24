import { Clickable } from "@shared/ui/components/Clickable";
import { SearchInput } from "@shared/ui/components/SearchInput";
import type { NoteFilterMode } from "../types";

interface NoteFiltersProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	activeFilter: NoteFilterMode;
	onFilterChange: (filter: NoteFilterMode) => void;
	counts: Record<NoteFilterMode, number>;
}

const FILTERS: { mode: NoteFilterMode; label: string }[] = [
	{ mode: "all", label: "All" },
	{ mode: "due", label: "Due" },
	{ mode: "new", label: "New" },
	{ mode: "learning", label: "Learning" },
	{ mode: "overdue", label: "Overdue" },
];

export function NoteFilters({
	searchQuery,
	onSearchChange,
	activeFilter,
	onFilterChange,
	counts,
}: NoteFiltersProps) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<SearchInput
				value={searchQuery}
				placeholder="Search notes..."
				onChange={onSearchChange}
			/>
			<div class="ep:flex ep:gap-1.5 ep:flex-wrap" role="tablist">
				{FILTERS.map(({ mode, label }) => {
					const isActive = activeFilter === mode;
					const count = counts[mode];
					return (
						<Clickable
							key={mode}
							role="tab"
							aria-selected={isActive}
							class={[
								"ep:px-2.5 ep:py-1 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:transition-colors ep:duration-150",
								isActive
									? "ep:bg-obs-interactive ep:text-obs-on-interactive"
									: "ep:bg-obs-secondary ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
							].join(" ")}
							onClick={() => onFilterChange(mode)}
						>
							{label}
							{count > 0 && mode !== "all" && (
								<span class="ep:ml-1 ep:opacity-70">
									{count}
								</span>
							)}
						</Clickable>
					);
				})}
			</div>
		</div>
	);
}
