import { Clickable } from "@shared/ui/components/Clickable";
import { cn } from "@shared/ui/utils";
import type { DashboardTab } from "../types";

interface DashboardTabsProps {
	activeTab: DashboardTab;
	onTabChange: (tab: DashboardTab) => void;
	projectCount: number;
	notesCount: number;
	orphanedCount: number;
	showArchived: boolean;
	onToggleArchived: () => void;
}

const BASE_TABS: { id: DashboardTab; label: string }[] = [
	{ id: "projects", label: "Projects" },
	{ id: "notes", label: "Notes" },
];

const _CHIP_BASE =
	"ep:px-2.5 ep:py-1 ep:rounded-full ep:text-ui-smaller ep:font-medium ep:transition-colors ep:duration-150";
const CHIP_ACTIVE = "ep:bg-obs-interactive/15 ep:text-obs-interactive";
const CHIP_INACTIVE =
	"ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal";

export function DashboardTabs({
	activeTab,
	onTabChange,
	projectCount,
	notesCount,
	orphanedCount,
	showArchived,
	onToggleArchived,
}: DashboardTabsProps) {
	const tabs =
		orphanedCount > 0
			? [...BASE_TABS, { id: "orphaned" as DashboardTab, label: "Orphaned" }]
			: BASE_TABS;

	const counts: Record<DashboardTab, number> = {
		projects: projectCount,
		notes: notesCount,
		orphaned: orphanedCount,
	};

	return (
		<div class="ep:border-b ep:border-obs-border">
			<div class="ep:flex ep:items-center ep:gap-6" role="tablist">
				{tabs.map(({ id, label }) => {
					const isActive = activeTab === id;
					const count = counts[id];
					return (
						<Clickable
							key={id}
							role="tab"
							aria-selected={isActive}
							class={cn(
								"ep:relative ep:pb-2.5 ep:text-sm ep:transition-colors ep:duration-150",
								isActive
									? "ep:text-obs-normal ep:font-semibold"
									: "ep:text-obs-muted ep:hover:text-obs-normal",
							)}
							onClick={() => onTabChange(id)}
						>
							{label}
							{count > 0 && (
								<span class="ep:ml-1.5 ep:text-obs-faint ep:tabular-nums ep:font-normal">
									{count}
								</span>
							)}
							{isActive && (
								<div class="ep:absolute ep:bottom-[-1px] ep:left-0 ep:right-0 ep:h-[2px] ep:bg-obs-interactive ep:rounded-t" />
							)}
						</Clickable>
					);
				})}

				<Clickable
					class={cn(
						"ep:ml-auto ep:mb-1 ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:transition-colors ep:duration-150",
						showArchived ? CHIP_ACTIVE : CHIP_INACTIVE,
					)}
					onClick={onToggleArchived}
					aria-label="Toggle archived items"
				>
					Archived
				</Clickable>
			</div>
		</div>
	);
}
