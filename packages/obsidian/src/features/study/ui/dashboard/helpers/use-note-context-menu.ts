import type { MenuItem } from "@true-recall/obsidian/preact/useContextMenu";
import { useContextMenu } from "@true-recall/obsidian/preact/useContextMenu";

import type { DashboardNoteEntry } from "../types";

interface UseNoteContextMenuOptions {
	note: DashboardNoteEntry;
	onStudy: () => void;
	onCustomStudy: () => void;
	onNavigate: () => void;
	onRename?: () => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onDetach?: () => void;
	onEnterSelection?: () => void;
	onCreateProject?: () => void;
	onRemoveProjectStatus?: () => void;
	onAssignToProject?: () => void;
}

export function useNoteContextMenu({
	note,
	onStudy,
	onCustomStudy,
	onNavigate,
	onRename,
	onArchive,
	onUnarchive,
	onDetach,
	onEnterSelection,
	onCreateProject,
	onRemoveProjectStatus,
	onAssignToProject,
}: UseNoteContextMenuOptions) {
	const menuItems: MenuItem[] = [
		{ title: "Study", icon: "play", onClick: onStudy },
		{
			title: "Custom session",
			icon: "sliders-horizontal",
			onClick: onCustomStudy,
		},
		{ title: "Go to note", icon: "file-text", onClick: onNavigate },
		{ title: "Rename", icon: "pencil", onClick: () => onRename?.() },
		note.archived
			? {
					title: "Unarchive",
					icon: "archive-restore",
					onClick: () => onUnarchive?.(),
				}
			: { title: "Archive", icon: "archive", onClick: () => onArchive?.() },
		...(onDetach
			? [
					"separator" as const,
					{ title: "Detach from project", icon: "unlink", onClick: onDetach },
				]
			: []),
		...(onCreateProject || onRemoveProjectStatus || onAssignToProject
			? [
					"separator" as const,
					...(onCreateProject
						? [
								{
									title: "Convert to project",
									icon: "folder-plus",
									onClick: onCreateProject,
								},
							]
						: []),
					...(onRemoveProjectStatus
						? [
								{
									title: "Remove project status",
									icon: "folder-minus",
									onClick: onRemoveProjectStatus,
								},
							]
						: []),
					...(onAssignToProject
						? [
								{
									title: "Assign to project",
									icon: "folder-input",
									onClick: onAssignToProject,
								},
							]
						: []),
				]
			: []),
		...(onEnterSelection
			? [
					"separator" as const,
					{ title: "Select", icon: "check-square", onClick: onEnterSelection },
				]
			: []),
	];

	return useContextMenu(menuItems);
}
