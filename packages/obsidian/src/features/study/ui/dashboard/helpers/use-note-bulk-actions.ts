import type { Signal } from "@preact/signals";
import { NamePromptModal } from "@true-recall/obsidian/modals/study/NamePromptModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice, normalizePath, TFile } from "obsidian";
import { useCallback } from "preact/hooks";
import type { DashboardNoteEntry } from "../types";

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

		const modal = new NamePromptModal(plugin.app, "New Project");
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		const name = result.name;
		const projectPath = normalizePath(`${name}.md`);

		if (plugin.app.vault.getAbstractFileByPath(projectPath)) {
			new Notice(`A note already exists at "${projectPath}".`);
			return;
		}

		await plugin.app.vault.create(projectPath, "");

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		for (const path of selectedPaths.value) {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await frontmatterService.addParent(file.path, name);
			}
		}

		new Notice(
			`Created project "${name}" with ${selectedPaths.value.size} notes`,
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

	return {
		handleCreateProjectFromSelected,
		handleArchiveSelected,
		handleStudySelected,
	};
}
