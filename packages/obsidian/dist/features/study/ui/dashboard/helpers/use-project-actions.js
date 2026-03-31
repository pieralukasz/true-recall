import { __awaiter } from "tslib";
import { RenameModal } from "@true-recall/obsidian/modals/study/RenameModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice, normalizePath, TFile, TFolder } from "obsidian";
import { useCallback } from "preact/hooks";
export function useProjectActions() {
    const plugin = usePlugin();
    const handleArchive = useCallback((path, archived) => {
        const file = plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            void plugin.flashcardManager
                .getFrontmatterService()
                .setArchive(file.path, archived);
        }
    }, [plugin]);
    const handleRename = useCallback((path) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const file = plugin.app.vault.getAbstractFileByPath(path);
        if (!file)
            return;
        const modal = new RenameModal(plugin.app, file);
        const result = yield modal.openAndWait();
        if (result.cancelled)
            return;
        const parent = (_b = (_a = file.parent) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "";
        const newName = file instanceof TFile
            ? `${result.newName}.${file.extension}`
            : result.newName;
        const newPath = normalizePath(parent ? `${parent}/${newName}` : newName);
        if (plugin.app.vault.getAbstractFileByPath(newPath)) {
            new Notice(`A ${file instanceof TFolder ? "folder" : "file"} already exists at "${newPath}".`);
            return;
        }
        yield plugin.app.fileManager.renameFile(file, newPath);
    }), [plugin]);
    return { handleArchive, handleRename };
}
