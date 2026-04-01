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
