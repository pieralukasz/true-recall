import type { App, Plugin } from "obsidian";

import type { IVaultEventBridge } from "@true-recall/core";

export class ObsidianVaultEventBridge implements IVaultEventBridge {
	constructor(
		private app: App,
		private plugin: Plugin,
	) {}

	onMetadataChanged(
		callback: (
			path: string,
			frontmatter: Record<string, unknown> | undefined,
		) => void,
	): () => void {
		const ref = this.app.metadataCache.on("changed", (file, _data, cache) => {
			callback(file.path, cache?.frontmatter);
		});
		this.plugin.registerEvent(ref);
		return () => this.app.metadataCache.offref(ref);
	}

	onFileDeleted(callback: (path: string) => void): () => void {
		const ref = this.app.vault.on("delete", (file) => {
			callback(file.path);
		});
		this.plugin.registerEvent(ref);
		return () => this.app.vault.offref(ref);
	}

	onFileRenamed(
		callback: (newPath: string, oldPath: string) => void,
	): () => void {
		const ref = this.app.vault.on("rename", (file, oldPath) => {
			callback(file.path, oldPath);
		});
		this.plugin.registerEvent(ref);
		return () => this.app.vault.offref(ref);
	}

	onLayoutReady(callback: () => void): void {
		this.app.workspace.onLayoutReady(callback);
	}
}
