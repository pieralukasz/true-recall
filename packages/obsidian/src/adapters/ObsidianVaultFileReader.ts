import type { IVaultFileReader } from "@true-recall/core/integration/anki-media.service";
import { type App, normalizePath } from "obsidian";

/**
 * Reads vault files for the AnkiMediaService.
 */
export class ObsidianVaultFileReader implements IVaultFileReader {
	constructor(private app: App) {}

	async exists(path: string): Promise<boolean> {
		const normalized = normalizePath(path);
		return await this.app.vault.adapter.exists(normalized);
	}

	async readBinary(path: string): Promise<ArrayBuffer> {
		const normalized = normalizePath(path);
		return await this.app.vault.adapter.readBinary(normalized);
	}

	findByName(filename: string): string | null {
		const allFiles = this.app.vault.getFiles();
		const found = allFiles.find((f) => f.name === filename);
		return found?.path ?? null;
	}
}
