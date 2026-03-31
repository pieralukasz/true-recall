import type { ISourceUidResolver } from "@true-recall/core/integration/csv/csv-export.service";
import type { App } from "obsidian";

/**
 * Resolves flashcard_uid → note name by scanning the vault's metadata cache.
 */
export class ObsidianSourceUidResolver implements ISourceUidResolver {
	constructor(private app: App) {}

	resolveSourceUids(): Map<string, { name: string }> {
		const map = new Map<string, { name: string }>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const uid = cache.frontmatter.flashcard_uid as string | undefined;
			if (!uid) continue;

			map.set(uid, { name: file.basename });
		}

		return map;
	}
}
