import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";
import type { NoteFilterMode, ProjectFilter } from "../types";

interface NoteFiltersProps {
	activeFilter: NoteFilterMode;
	onFilterChange: (filter: NoteFilterMode) => void;
	counts: Record<NoteFilterMode, number>;
	projectFilter: ProjectFilter;
	unassignedCount: number;
	onProjectFilterChange: (filter: ProjectFilter) => void;
}

const CHIP_BASE =
	"ep:px-2.5 ep:py-1 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:transition-colors ep:duration-150";
const CHIP_ACTIVE = "ep:bg-obs-interactive/15 ep:text-obs-interactive";
const CHIP_INACTIVE =
	"ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal";

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
	projectFilter,
	unassignedCount,
	onProjectFilterChange,
}: NoteFiltersProps) {
	return (
		<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-1.5" role="tablist">
			{/* State filters */}
			{FILTERS.map(({ mode, label }) => {
				const isActive = activeFilter === mode;
				const count = counts[mode];
				return (
					<Clickable
						key={mode}
						role="tab"
						aria-selected={isActive}
						class={cn(CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_INACTIVE)}
						onClick={() => onFilterChange(mode)}
					>
						{label}
						{count > 0 && mode !== "all" && (
							<span
								class={cn(
									"ep:ml-1 ep:tabular-nums",
									isActive ? "ep:text-obs-interactive/70" : "ep:text-obs-faint",
								)}
							>
								{count}
							</span>
						)}
					</Clickable>
				);
			})}

			{/* Divider */}
			<div class="ep:w-px ep:h-4 ep:bg-obs-border ep:self-center ep:mx-0.5" />

			{/* Unassigned chip */}
			<Clickable
				class={cn(
					CHIP_BASE,
					projectFilter.type === "unassigned" ? CHIP_ACTIVE : CHIP_INACTIVE,
				)}
				onClick={() => {
					onProjectFilterChange(
						projectFilter.type === "unassigned"
							? { type: "none" }
							: { type: "unassigned" },
					);
				}}
			>
				Unassigned
				{unassignedCount > 0 && (
					<span
						class={cn(
							"ep:ml-1 ep:tabular-nums",
							projectFilter.type === "unassigned"
								? "ep:text-obs-interactive/70"
								: "ep:text-obs-faint",
						)}
					>
						{unassignedCount}
					</span>
				)}
			</Clickable>

			{/* Active project filter chip */}
			{projectFilter.type === "project" && (
				<div class="ep:inline-flex ep:items-center ep:gap-1 ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-interactive/15 ep:text-obs-interactive ep:text-ui-smaller ep:font-medium">
					{projectFilter.name}
					<Clickable
						class="ep:text-obs-interactive/50 ep:hover:text-obs-interactive ep:text-[10px] ep:leading-none"
						onClick={() => onProjectFilterChange({ type: "none" })}
						aria-label="Clear project filter"
					>
						&#10005;
					</Clickable>
				</div>
			)}
		</div>
	);
}
