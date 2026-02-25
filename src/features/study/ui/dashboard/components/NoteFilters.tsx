import { Clickable } from "@shared/ui/components/Clickable";
import { cn } from "@shared/ui/utils";
import type { NoteFilterMode } from "../types";

interface NoteFiltersProps {
	activeFilter: NoteFilterMode;
	onFilterChange: (filter: NoteFilterMode) => void;
	counts: Record<NoteFilterMode, number>;
}

const FILTERS: { mode: NoteFilterMode; label: string }[] = [
	{ mode: "all", label: "All" },
	{ mode: "due", label: "Due" },
	{ mode: "new", label: "New" },
	{ mode: "learning", label: "Learn" },
	{ mode: "overdue", label: "Overdue" },
];

export function NoteFilters({
	activeFilter,
	onFilterChange,
	counts,
}: NoteFiltersProps) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<div
				class="ep:flex ep:rounded-md ep:bg-obs-secondary ep:p-0.5"
				role="tablist"
			>
				{FILTERS.map(({ mode, label }) => {
					const isActive = activeFilter === mode;
					const count = counts[mode];
					return (
						<Clickable
							key={mode}
							role="tab"
							aria-selected={isActive}
							class={cn(
								"ep:flex-1 ep:px-2 ep:py-1 ep:rounded ep:text-center ep:text-ui-smaller ep:font-medium ep:transition-colors ep:duration-150",
								isActive
									? "ep:bg-obs-primary ep:text-obs-normal ep:shadow-sm"
									: "ep:text-obs-muted ep:hover:text-obs-normal",
							)}
							onClick={() => onFilterChange(mode)}
						>
							{label}
							{count > 0 && mode !== "all" && (
								<span class="ep:ml-1 ep:text-obs-faint ep:tabular-nums">
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
