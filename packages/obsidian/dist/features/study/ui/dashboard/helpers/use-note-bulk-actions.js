import { __awaiter } from "tslib";
import { NamePromptModal } from "@true-recall/obsidian/modals/study/NamePromptModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice, normalizePath, TFile } from "obsidian";
import { useCallback } from "preact/hooks";
export function useNoteBulkActions({ selectedPaths, filteredNotes, exitSelection, }) {
    const plugin = usePlugin();
    const handleCreateProjectFromSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (selectedPaths.value.size === 0)
            return;
        const modal = new NamePromptModal(plugin.app, "New Project");
        const result = yield modal.openAndWait();
        if (result.cancelled)
            return;
        const name = result.name;
        const projectPath = normalizePath(`${name}.md`);
        if (plugin.app.vault.getAbstractFileByPath(projectPath)) {
            new Notice(`A note already exists at "${projectPath}".`);
            return;
        }
        yield plugin.app.vault.create(projectPath, "");
        const frontmatterService = plugin.flashcardManager.getFrontmatterService();
        for (const path of selectedPaths.value) {
            const file = plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                yield frontmatterService.addParent(file.path, name);
            }
        }
        new Notice(`Created project "${name}" with ${selectedPaths.value.size} notes`);
        exitSelection();
    }), [plugin, selectedPaths, exitSelection]);
    const handleArchiveSelected = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (selectedPaths.value.size === 0)
            return;
        const frontmatterService = plugin.flashcardManager.getFrontmatterService();
        for (const path of selectedPaths.value) {
            const file = plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                yield frontmatterService.setArchive(file.path, true);
            }
        }
        new Notice(`Archived ${selectedPaths.value.size} notes`);
        exitSelection();
    }), [plugin, selectedPaths, exitSelection]);
    const handleStudySelected = useCallback(() => {
        if (selectedPaths.value.size === 0)
            return;
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
