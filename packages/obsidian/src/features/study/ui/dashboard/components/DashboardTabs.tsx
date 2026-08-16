import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";
import {
	capabilities,
	isMobile,
} from "@true-recall/obsidian/utils/platform";

import type { DashboardTab } from "../types";

interface DashboardTabsProps {
	activeTab: DashboardTab;
	onTabChange: (tab: DashboardTab) => void;
	projectCount: number;
	notesCount: number;
	customCount: number;
	orphanedCount: number;
	showArchived: boolean;
	onToggleArchived: () => void;
	onCreateProject?: () => void;
	onCreateCustomSession?: () => void;
}

const BASE_TABS: { id: DashboardTab; label: string }[] = [
	{ id: "projects", label: "Projects" },
	{ id: "notes", label: "Notes" },
	{ id: "custom", label: "Custom" },
];

const CHIP_ACTIVE = "ep:bg-obs-interactive/15 ep:text-obs-interactive";
const CHIP_INACTIVE =
	"ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal";

export function DashboardTabs({
	activeTab,
	onTabChange,
	projectCount,
	notesCount,
	customCount,
	orphanedCount,
	showArchived,
	onToggleArchived,
	onCreateProject,
	onCreateCustomSession,
}: DashboardTabsProps) {
	// The orphaned tab deep-links into the card browser, which does not
	// exist on mobile; hiding the tab avoids a dead end.
	const tabs =
		orphanedCount > 0 && capabilities.canUseCardBrowser()
			? [...BASE_TABS, { id: "orphaned" as DashboardTab, label: "Orphaned" }]
			: BASE_TABS;

	const counts: Record<DashboardTab, number> = {
		projects: projectCount,
		notes: notesCount,
		custom: customCount,
		orphaned: orphanedCount,
	};
	const showArchivedControl = activeTab === "projects" || activeTab === "notes";

	return (
		<div class="ep:border-b ep:border-obs-border">
			<div
				class={cn(
					"ep:flex ep:items-center",
					isMobile() ? "ep:gap-3" : "ep:gap-6",
				)}
				role="tablist"
			>
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
									{id === "custom" ? `(${count})` : count}
								</span>
							)}
							{isActive && (
								<div class="ep:absolute ep:bottom-[-1px] ep:left-0 ep:right-0 ep:h-[2px] ep:bg-obs-interactive ep:rounded-t" />
							)}
						</Clickable>
					);
				})}

				<div class="ep:ml-auto ep:flex ep:items-center ep:gap-1.5">
					{activeTab === "projects" && onCreateProject && (
						<Clickable
							class={cn(
								"ep:mb-1 ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:transition-colors ep:duration-150",
								CHIP_INACTIVE,
							)}
							onClick={onCreateProject}
							aria-label="Create project"
						>
							+ Project
						</Clickable>
					)}
					{activeTab === "custom" && onCreateCustomSession ? (
						<Clickable
							class={cn(
								"ep:mb-1 ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:transition-colors ep:duration-150",
								CHIP_INACTIVE,
							)}
							onClick={onCreateCustomSession}
							aria-label="Create custom study session"
						>
							+ Session
						</Clickable>
					) : null}
					{showArchivedControl && (
						<Clickable
							class={cn(
								"ep:mb-1 ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:transition-colors ep:duration-150",
								showArchived ? CHIP_ACTIVE : CHIP_INACTIVE,
							)}
							onClick={onToggleArchived}
							aria-label="Toggle archived items"
						>
							Archived
						</Clickable>
					)}
				</div>
			</div>
		</div>
	);
}
