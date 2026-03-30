import { RenameModal } from "@true-recall/obsidian/modals/study/RenameModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice, normalizePath, TFile, TFolder } from "obsidian";
import { useCallback } from "preact/hooks";

export function useProjectActions() {
	const plugin = usePlugin();

	const handleArchive = useCallback(
		(path: string, archived: boolean) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				void plugin.flashcardManager
					.getFrontmatterService()
					.setArchive(file.path, archived);
			}
		},
		[plugin],
	);

	const handleRename = useCallback(
		async (path: string) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (!file) return;

			const modal = new RenameModal(plugin.app, file);
			const result = await modal.openAndWait();
			if (result.cancelled) return;

			const parent = file.parent?.path ?? "";
			const newName =
				file instanceof TFile
					? `${result.newName}.${file.extension}`
					: result.newName;
			const newPath = normalizePath(parent ? `${parent}/${newName}` : newName);

			if (plugin.app.vault.getAbstractFileByPath(newPath)) {
				new Notice(
					`A ${file instanceof TFolder ? "folder" : "file"} already exists at "${newPath}".`,
				);
				return;
			}

			await plugin.app.fileManager.renameFile(file, newPath);
		},
		[plugin],
	);

	return { handleArchive, handleRename };
}
