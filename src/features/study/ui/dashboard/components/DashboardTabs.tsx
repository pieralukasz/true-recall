import { Clickable } from "@shared/ui/components/Clickable";
import { cn } from "@shared/ui/utils";
import type { DashboardTab } from "../types";

interface DashboardTabsProps {
	activeTab: DashboardTab;
	onTabChange: (tab: DashboardTab) => void;
	projectCount: number;
	notesCount: number;
}

const TABS: { id: DashboardTab; label: string }[] = [
	{ id: "projects", label: "Projects" },
	{ id: "notes", label: "Notes" },
];

export function DashboardTabs({
	activeTab,
	onTabChange,
	projectCount,
	notesCount,
}: DashboardTabsProps) {
	const counts: Record<DashboardTab, number> = {
		projects: projectCount,
		notes: notesCount,
	};

	return (
		<div class="ep:border-b ep:border-obs-border">
			<div class="ep:flex ep:gap-6" role="tablist">
				{TABS.map(({ id, label }) => {
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
			</div>
		</div>
	);
}
