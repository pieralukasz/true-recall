import type { MenuItem } from "@true-recall/obsidian/preact/useContextMenu";
import { useContextMenu } from "@true-recall/obsidian/preact/useContextMenu";

import type { DashboardProject } from "../types";

interface UseProjectContextMenuOptions {
	project: DashboardProject;
	isVirtual: boolean;
	onStudyProject: () => void;
	onCustomStudy: () => void;
	onNavigate?: () => void;
	onPresetClick?: () => void;
	onRename?: () => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onDissolve?: () => void;
	onMoveChildren?: () => void;
	onDelete?: () => void;
	onExportAnki?: () => void;
	onExportCsv?: () => void;
	onCreateSubProject?: () => void;
	onPostpone?: () => void;
	onAdvance?: () => void;
	onReschedule?: () => void;
	onRescheduleRecent?: () => void;
	onScheduleBreak?: () => void;
	onFlatten?: () => void;
	onBalance?: () => void;
	onForecast?: () => void;
}

export function useProjectContextMenu({
	project,
	isVirtual,
	onStudyProject,
	onCustomStudy,
	onNavigate,
	onPresetClick,
	onRename,
	onArchive,
	onUnarchive,
	onDissolve,
	onMoveChildren,
	onDelete,
	onExportAnki,
	onExportCsv,
	onCreateSubProject,
	onPostpone,
	onAdvance,
	onReschedule,
	onRescheduleRecent,
	onScheduleBreak,
	onFlatten,
	onBalance,
	onForecast,
}: UseProjectContextMenuOptions) {
	const menuItems: MenuItem[] = [
		{ title: "Study", icon: "play", onClick: onStudyProject },
		{
			title: "Custom session",
			icon: "sliders-horizontal",
			onClick: onCustomStudy,
		},
		...(!isVirtual
			? [
					"separator" as const,
					{
						title: "Go to note",
						icon: "file-text",
						onClick: () => onNavigate?.(),
					},
					{ title: "Rename", icon: "pencil", onClick: () => onRename?.() },
					...(onPresetClick
						? [
								{
									title: "Set FSRS preset",
									icon: "settings",
									onClick: onPresetClick,
								},
							]
						: []),
					project.archived
						? {
								title: "Unarchive",
								icon: "archive-restore",
								onClick: () => onUnarchive?.(),
							}
						: {
								title: "Archive",
								icon: "archive",
								onClick: () => onArchive?.(),
							},
					{
						title: "Scheduling",
						icon: "calendar-clock",
						children: [
							{
								title: "Workload forecast…",
								icon: "line-chart",
								onClick: () => onForecast?.(),
							},
							"separator" as const,
							{
								title: "Reschedule all cards",
								icon: "refresh-cw",
								onClick: () => onReschedule?.(),
							},
							{
								title: "Reschedule cards reviewed in the last 7 days",
								icon: "history",
								onClick: () => onRescheduleRecent?.(),
							},
							{
								title: "Schedule a break…",
								icon: "palmtree",
								onClick: () => onScheduleBreak?.(),
							},
							"separator" as const,
							{
								title: "Postpone cards…",
								icon: "calendar-plus",
								onClick: () => onPostpone?.(),
							},
							{
								title: "Advance cards…",
								icon: "calendar-minus",
								onClick: () => onAdvance?.(),
							},
							{
								title: "Flatten future due cards…",
								icon: "bar-chart-2",
								onClick: () => onFlatten?.(),
							},
							{
								title: "Balance workload…",
								icon: "scale",
								onClick: () => onBalance?.(),
							},
						],
					},
					{
						title: "Export",
						icon: "download",
						children: [
							{
								title: "Anki (.apkg)",
								icon: "file-down",
								onClick: () => onExportAnki?.(),
							},
							{
								title: "CSV",
								icon: "file-spreadsheet",
								onClick: () => onExportCsv?.(),
							},
						],
					},
					"separator" as const,
					{
						title: "Project",
						icon: "folder-cog",
						children: [
							{
								title: "Create sub-project",
								icon: "folder-plus",
								onClick: () => onCreateSubProject?.(),
							},
							{
								title: "Move children to…",
								icon: "folder-input",
								onClick: () => onMoveChildren?.(),
							},
							{
								title: "Dissolve project",
								icon: "unlink",
								onClick: () => onDissolve?.(),
							},
							"separator" as const,
							{
								title: "Delete project",
								icon: "trash-2",
								onClick: () => onDelete?.(),
							},
						],
					},
				]
			: []),
	];

	return useContextMenu(menuItems);
}
