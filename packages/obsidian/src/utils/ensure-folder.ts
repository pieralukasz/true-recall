import { normalizePath, type Vault } from "obsidian";

/**
 * Creates every missing segment of a folder path. `vault.create` throws when
 * the parent folder does not exist, and folder settings accept paths that
 * have not been created yet.
 */
export async function ensureFolderExists(
	vault: Vault,
	folderPath: string,
): Promise<void> {
	const trimmed = folderPath.trim();
	if (!trimmed || trimmed === "/") return;
	let current = "";
	for (const part of trimmed.split("/")) {
		if (!part) continue;
		current = current ? `${current}/${part}` : part;
		const normalized = normalizePath(current);
		if (!vault.getAbstractFileByPath(normalized)) {
			await vault.createFolder(normalized);
		}
	}
}
