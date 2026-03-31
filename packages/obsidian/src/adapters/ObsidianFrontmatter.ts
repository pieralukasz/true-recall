import type { IFrontmatter } from "@true-recall/core";
import { type App, TFile } from "obsidian";

export class ObsidianFrontmatter implements IFrontmatter {
	constructor(private app: App) {}

	async read(filePath: string): Promise<Record<string, unknown>> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) return {};
		const cache = this.app.metadataCache.getFileCache(file);
		return (cache?.frontmatter as Record<string, unknown>) ?? {};
	}

	async update(
		filePath: string,
		changes: Record<string, unknown>,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) return;
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			Object.assign(fm, changes);
		});
	}
}
