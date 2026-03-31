import type { IAnkiImportVault } from "@true-recall/core/integration/anki/anki-import.service";
import { type App, normalizePath, type TFile } from "obsidian";

/**
 * Implements vault operations needed by AnkiImportService using Obsidian's API.
 */
export class ObsidianAnkiImportVault implements IAnkiImportVault {
	constructor(private app: App) {}

	async exists(path: string): Promise<boolean> {
		const normalized = normalizePath(path);
		return this.app.vault.getAbstractFileByPath(normalized) !== null;
	}

	async ensureFolderRecursive(folderPath: string): Promise<void> {
		const parts = folderPath.split("/");
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const normalized = normalizePath(current);
			if (!this.app.vault.getAbstractFileByPath(normalized)) {
				await this.app.vault.createFolder(normalized);
			}
		}
	}

	async createFile(path: string, content: string): Promise<void> {
		const normalized = normalizePath(path);
		await this.app.vault.create(normalized, content);
	}

	async readFile(path: string): Promise<string> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		if (!file) throw new Error(`File not found: ${path}`);
		return await this.app.vault.read(file as TFile);
	}

	async appendToFile(path: string, content: string): Promise<void> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(
			normalized,
		) as TFile | null;
		if (!file) throw new Error(`File not found: ${path}`);
		await this.app.vault.process(file, (existing) => `${existing}${content}`);
	}

	async prependToFile(path: string, content: string): Promise<void> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(
			normalized,
		) as TFile | null;
		if (!file) throw new Error(`File not found: ${path}`);
		await this.app.vault.process(file, (existing) => `${content}${existing}`);
	}

	async getFrontmatterUid(path: string): Promise<string | null> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(
			normalized,
		) as TFile | null;
		if (!file) return null;

		const cache = this.app.metadataCache.getFileCache(file);
		return (cache?.frontmatter?.flashcard_uid as string | undefined) ?? null;
	}

	async addParentToFrontmatter(
		path: string,
		parentName: string,
	): Promise<void> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(
			normalized,
		) as TFile | null;
		if (!file) return;

		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				const existing: string[] = Array.isArray(fm.parents)
					? (fm.parents as string[])
					: [];
				const names = new Set(
					existing.map((p: string) => p.replace(/^\[\[|\]\]$/g, "")),
				);
				if (!names.has(parentName)) {
					existing.push(`[[${parentName}]]`);
					fm.parents = existing;
				}
			},
		);
	}
}
