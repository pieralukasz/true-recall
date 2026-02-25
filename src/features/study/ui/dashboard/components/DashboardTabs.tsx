import { Clickable } from "@shared/ui/components/Clickable";
import { cn } from "@shared/ui/utils";
import type { DashboardTab } from "../types";

interface DashboardTabsProps {
	activeTab: DashboardTab;
	onTabChange: (tab: DashboardTab) => void;
	projectCount: number;
	unassignedCount: number;
	allNotesCount: number;
}

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
	{ id: "projects", label: "Projects", icon: "\uD83D\uDCC2" },
	{ id: "unassigned", label: "Unassigned", icon: "\uD83D\uDCC4" },
	{ id: "all", label: "All Notes", icon: "\uD83D\uDCCB" },
];

export function DashboardTabs({
	activeTab,
	onTabChange,
	projectCount,
	unassignedCount,
	allNotesCount,
}: DashboardTabsProps) {
	const counts: Record<DashboardTab, number> = {
		projects: projectCount,
		unassigned: unassignedCount,
		all: allNotesCount,
	};

	return (
		<div
			class="ep:flex ep:rounded-md ep:bg-obs-secondary ep:p-0.5"
			role="tablist"
		>
			{TABS.map(({ id, label, icon }) => {
				const isActive = activeTab === id;
				const count = counts[id];
				return (
					<Clickable
						key={id}
						role="tab"
						aria-selected={isActive}
						class={cn(
							"ep:flex-1 ep:px-3 ep:py-1.5 ep:rounded ep:text-center ep:text-ui-smaller ep:font-medium ep:transition-colors ep:duration-150",
							isActive
								? "ep:bg-obs-primary ep:text-obs-normal ep:shadow-sm"
								: "ep:text-obs-muted ep:hover:text-obs-normal",
						)}
						onClick={() => onTabChange(id)}
					>
						<span class="ep:mr-1">{icon}</span>
						{label}
						{count > 0 && (
							<span class="ep:ml-1.5 ep:text-obs-faint ep:tabular-nums">
								({count})
							</span>
						)}
					</Clickable>
				);
			})}
		</div>
	);
}
