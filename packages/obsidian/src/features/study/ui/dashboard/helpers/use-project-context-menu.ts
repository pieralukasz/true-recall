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
					"separator" as const,
					{
						title: "Project",
						icon: "folder-cog",
						children: [
							{
								title: "Set preset",
								icon: "settings",
								onClick: () => onPresetClick?.(),
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
						],
					},
				]
			: []),
	];

	return useContextMenu(menuItems);
}
