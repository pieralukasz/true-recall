import { type App, TFile } from "obsidian";

import type { IMetadataIndex } from "@true-recall/core";

export class ObsidianMetadataIndex implements IMetadataIndex {
	constructor(private app: App) {}

	getPathByFieldValue(field: string, value: string): string | null {
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm && String(fm[field]) === value) {
				return file.path;
			}
		}
		return null;
	}

	getFieldValue(path: string, field: string): unknown {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) return undefined;
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.frontmatter?.[field];
	}

	getAllPathsWithField(field: string): Map<string, unknown> {
		const result = new Map<string, unknown>();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm && field in fm) {
				result.set(file.path, fm[field]);
			}
		}
		return result;
	}

	onFieldChange(
		field: string,
		callback: (path: string, oldValue: unknown, newValue: unknown) => void,
	): () => void {
		// Track current values so we can detect changes
		const tracked = new Map<string, unknown>();

		// Initialize tracked values
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const value = cache?.frontmatter?.[field];
			if (value !== undefined) {
				tracked.set(file.path, value);
			}
		}

		const ref = this.app.metadataCache.on("changed", (file, _data, cache) => {
			const newValue = cache.frontmatter?.[field];
			const oldValue = tracked.get(file.path);

			if (oldValue !== newValue) {
				if (newValue !== undefined) {
					tracked.set(file.path, newValue);
				} else {
					tracked.delete(file.path);
				}
				callback(file.path, oldValue, newValue);
			}
		});

		return () => {
			this.app.metadataCache.offref(ref);
		};
	}
}
