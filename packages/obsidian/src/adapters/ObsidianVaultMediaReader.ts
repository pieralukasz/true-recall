import type { App } from "obsidian";

import type { IVaultMediaReader } from "@true-recall/core/integration/anki/anki-export.service";

/**
 * Reads binary media files from the Obsidian vault.
 */
export class ObsidianVaultMediaReader implements IVaultMediaReader {
	constructor(private app: App) {}

	async readBinaryByName(filename: string): Promise<ArrayBuffer | null> {
		const file = this.app.vault
			.getFiles()
			.find((f) => f.name === filename || f.path.endsWith(`/${filename}`));
		if (!file) return null;

		try {
			return await this.app.vault.readBinary(file);
		} catch {
			console.error(`[True Recall] Could not read media file: ${filename}`);
			return null;
		}
	}
}
