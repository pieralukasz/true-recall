import type { Signal } from "@preact/signals";
import { CreateProjectModal } from "@true-recall/obsidian/modals/study/CreateProjectModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice, TFile } from "obsidian";
import { useCallback } from "preact/hooks";
import type { DashboardNoteEntry } from "../types";
import { flattenNodes, ProjectSuggestModal } from "./use-project-actions";

export function useNoteBulkActions({
	selectedPaths,
	filteredNotes,
	exitSelection,
}: {
	selectedPaths: Signal<ReadonlySet<string>>;
	filteredNotes: DashboardNoteEntry[];
	exitSelection: () => void;
}) {
	const plugin = usePlugin();

	const handleCreateProjectFromSelected = useCallback(async () => {
		if (selectedPaths.value.size === 0) return;

		const modal = new CreateProjectModal(plugin.app);
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		await plugin.projectManagement.createProjectWithChildren(
			result.name,
			result.folder,
			[...selectedPaths.value],
		);
		exitSelection();
	}, [plugin, selectedPaths, exitSelection]);

	const handleArchiveSelected = useCallback(async () => {
		if (selectedPaths.value.size === 0) return;

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		for (const path of selectedPaths.value) {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await frontmatterService.setArchive(file.path, true);
			}
		}

		new Notice(`Archived ${selectedPaths.value.size} notes`);
		exitSelection();
	}, [plugin, selectedPaths, exitSelection]);

	const handleStudySelected = useCallback(() => {
		if (selectedPaths.value.size === 0) return;

		const noteNames = filteredNotes
			.filter((n) => n.path && selectedPaths.value.has(n.path))
			.map((n) => n.name);

		void plugin.openCustomStudyModal({
			sourceNoteFilters: noteNames,
			scopeLabel: `${noteNames.length} notes`,
		});

		exitSelection();
	}, [plugin, filteredNotes, selectedPaths, exitSelection]);

	const handleAssignToProject = useCallback(async () => {
		if (selectedPaths.value.size === 0) return;

		const hierarchy = plugin.hierarchyService.buildHierarchy();
		const allNodes = flattenNodes(hierarchy);
		if (allNodes.length === 0) {
			new Notice("No projects available. Create one first.");
			return;
		}

		const modal = new ProjectSuggestModal(plugin.app, allNodes);
		const target = await modal.openAndWait();
		if (!target) return;

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		for (const path of selectedPaths.value) {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await frontmatterService.addParent(file.path, target.name);
			}
		}

		new Notice(
			`Assigned ${selectedPaths.value.size} notes to "${target.name}"`,
		);
		exitSelection();
	}, [plugin, selectedPaths, exitSelection]);

	return {
		handleCreateProjectFromSelected,
		handleAssignToProject,
		handleArchiveSelected,
		handleStudySelected,
	};
}
