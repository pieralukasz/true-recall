import { TFile } from "obsidian";

import { usePlugin } from "@true-recall/obsidian/preact";

import { UNASSIGNED_PATH } from "../helpers/project-aggregation";
import type { FlatProjectItem } from "../helpers/project-tree-flatten";
import { useNoteContextMenu } from "../helpers/use-note-context-menu";
import type { ProjectActions } from "./useProjectsTabModel";
export function useProjectNoteActions(
	item: Extract<FlatProjectItem, { type: "note" }>,
	actions: ProjectActions,
	onStudyNote: (name: string, projectPath?: string, count?: number) => void,
	onPresetClick?: (path: string | null) => void,
	onEnterSelection?: () => void,
) {
	const plugin = usePlugin();

	const handleNavigate = () =>
		void plugin.app.workspace.openLinkText(item.note.name, "");

	const handleStudy = (cardCount?: number) =>
		onStudyNote(item.note.name, item.projectPath, cardCount);

	const handleCustomStudy = () => {
		void plugin.openCustomStudyModal({
			sourceNoteFilters: [item.note.name],
			scopeLabel: item.note.name,
		});
	};

	const handleDetach =
		item.projectPath !== UNASSIGNED_PATH
			? () => {
					if (!item.note.path) return;
					const file = plugin.app.vault.getAbstractFileByPath(item.note.path);
					if (!(file instanceof TFile)) return;
					const parentName =
						item.projectPath.split("/").pop()?.replace(/\.md$/, "") ?? "";
					void plugin.flashcardManager
						.getFrontmatterService()
						.removeParent(file.path, parentName);
				}
			: undefined;

	const notePath = item.note.path;
	const isUnassigned = item.projectPath === UNASSIGNED_PATH;
	const isExplicitProject =
		notePath && plugin.hierarchyService.isExplicitProject(notePath);
	const handleContextMenu = useNoteContextMenu({
		note: item.note,
		onStudy: handleStudy,
		onCustomStudy: handleCustomStudy,
		onNavigate: handleNavigate,
		onRename: notePath ? () => void actions.handleRename(notePath) : undefined,
		onSetPreset:
			onPresetClick && notePath ? () => onPresetClick(notePath) : undefined,
		onArchive: notePath
			? () => actions.handleArchive(notePath, true)
			: undefined,
		onUnarchive: notePath
			? () => actions.handleArchive(notePath, false)
			: undefined,
		onDetach: handleDetach,
		onEnterSelection,
		onCreateProject:
			isUnassigned && notePath && !isExplicitProject
				? () => void actions.handleConvertToProject(notePath)
				: undefined,
		onRemoveProjectStatus:
			isExplicitProject && notePath
				? () => void actions.handleRemoveProjectStatus(notePath)
				: undefined,
		onAssignToProject:
			isUnassigned && notePath
				? () => void actions.handleAssignNoteToProject(notePath)
				: undefined,
	});

	return {
		handleNavigate,
		handleStudy,
		handleCustomStudy,
		handleDetach,
		handleContextMenu,
	};
}
