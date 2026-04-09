import { type App, TFile } from "obsidian";

import type { IFileSystem } from "@true-recall/core";

export class ObsidianFileSystem implements IFileSystem {
	constructor(private app: App) {}

	async read(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`File not found: ${path}`);
		}
		return this.app.vault.read(file);
	}

	async write(path: string, content: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file && file instanceof TFile) {
			await this.app.vault.modify(file, content);
		} else {
			await this.app.vault.create(path, content);
		}
	}

	async delete(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file) await this.app.vault.delete(file);
	}

	async listMarkdownFiles(): Promise<string[]> {
		return this.app.vault.getMarkdownFiles().map((f) => f.path);
	}

	watch(
		callback: (event: "create" | "modify" | "delete", path: string) => void,
	): () => void {
		const onCreate = this.app.vault.on("create", (file) =>
			callback("create", file.path),
		);
		const onModify = this.app.vault.on("modify", (file) =>
			callback("modify", file.path),
		);
		const onDelete = this.app.vault.on("delete", (file) =>
			callback("delete", file.path),
		);
		return () => {
			this.app.vault.offref(onCreate);
			this.app.vault.offref(onModify);
			this.app.vault.offref(onDelete);
		};
	}
}
