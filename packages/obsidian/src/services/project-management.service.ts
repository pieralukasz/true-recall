import type { FrontmatterService } from "@true-recall/core/flashcard/source/frontmatter.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import { mutate } from "@true-recall/obsidian/data";
import type { App } from "obsidian";
import { Notice, normalizePath, TFile, TFolder } from "obsidian";

export class ProjectManagementService {
	constructor(
		private app: App,
		private frontmatterService: FrontmatterService,
		private hierarchyService: HierarchyService,
	) {}

	// === Project lifecycle ===

	async convertToProject(notePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return;

		await this.frontmatterService.markAsProject(file.path);
		this.invalidate();
		new Notice(`"${file.basename}" is now a project`);
	}

	async createProjectWithChildren(
		name: string,
		folder: string,
		childPaths: string[],
	): Promise<void> {
		const projectPath = normalizePath(
			folder ? `${folder}/${name}.md` : `${name}.md`,
		);

		if (this.app.vault.getAbstractFileByPath(projectPath)) {
			new Notice(`A note already exists at "${projectPath}".`);
			return;
		}

		await this.app.vault.create(projectPath, "");
		await this.frontmatterService.markAsProject(projectPath);

		for (const childPath of childPaths) {
			const file = this.app.vault.getAbstractFileByPath(childPath);
			if (file instanceof TFile) {
				await this.frontmatterService.addParent(file.path, name);
			}
		}

		this.invalidate();
		new Notice(`Created project "${name}" with ${childPaths.length} notes`);
	}

	async createSubProject(name: string, parentPath: string): Promise<void> {
		const parentName =
			parentPath.split("/").pop()?.replace(/\.md$/, "") ?? parentPath;
		const projectPath = normalizePath(`${name}.md`);

		if (this.app.vault.getAbstractFileByPath(projectPath)) {
			new Notice(`A note already exists at "${projectPath}".`);
			return;
		}

		await this.app.vault.create(projectPath, "");
		await this.frontmatterService.markAsProject(projectPath);
		await this.frontmatterService.addParent(projectPath, parentName);

		this.invalidate();
		new Notice(`Created sub-project "${name}" under "${parentName}"`);
	}

	async dissolveProject(projectPath: string): Promise<void> {
		const childPaths = this.hierarchyService.getChildPaths(projectPath);
		const isExplicit = this.hierarchyService.isExplicitProject(projectPath);
		const projectName = nameFromPath(projectPath);

		if (childPaths.length > 0) {
			await this.frontmatterService.dissolveProject(childPaths, projectName);
		}
		if (isExplicit) {
			await this.frontmatterService.unmarkProject(projectPath);
		}

		this.invalidate();
		new Notice(
			`Dissolved "${projectName}" — ${childPaths.length} notes detached.`,
		);
	}

	async deleteProject(
		allPaths: string[],
		softDeleteCards: () => void,
	): Promise<void> {
		softDeleteCards();

		for (const path of [...allPaths].reverse()) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file) await this.app.vault.trash(file, true);
		}

		// Trash empty ancestor folders
		const rootPath = allPaths[0];
		if (rootPath) {
			this.trashEmptyAncestors(rootPath);
		}

		mutate("cards:bulk", () => {});
		this.invalidate();
	}

	// === Hierarchy mutations ===

	async setArchive(path: string, archived: boolean): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;

		await this.frontmatterService.setArchive(file.path, archived);
		this.invalidate();
	}

	async setArchiveBatch(paths: string[], archived: boolean): Promise<void> {
		for (const path of paths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await this.frontmatterService.setArchive(file.path, archived);
			}
		}
		this.invalidate();
	}

	async assignToProject(
		notePaths: string[],
		targetName: string,
	): Promise<void> {
		for (const notePath of notePaths) {
			const file = this.app.vault.getAbstractFileByPath(notePath);
			if (file instanceof TFile) {
				await this.frontmatterService.addParent(file.path, targetName);
			}
		}
		this.invalidate();
	}

	async detachFromProject(notePath: string, parentName: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return;

		await this.frontmatterService.removeParent(file.path, parentName);
		this.invalidate();
	}

	async reparent(
		notePath: string,
		oldParentPath: string | null,
		newParentName: string,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return;

		if (oldParentPath) {
			const oldParentName = nameFromPath(oldParentPath);
			await this.frontmatterService.removeParent(file.path, oldParentName);
		}
		await this.frontmatterService.addParent(file.path, newParentName);
		this.invalidate();
	}

	async moveChildren(
		childPaths: string[],
		fromParent: string,
		toParent: string,
	): Promise<void> {
		await this.frontmatterService.moveChildren(
			childPaths,
			fromParent,
			toParent,
		);
		this.invalidate();
	}

	async renameProject(file: TFile | TFolder, newPath: string): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(newPath)) {
			const kind = file instanceof TFolder ? "folder" : "file";
			new Notice(`A ${kind} already exists at "${newPath}".`);
			return;
		}
		await this.app.fileManager.renameFile(file, newPath);
		this.invalidate();
	}

	// === Internal ===

	private invalidate(): void {
		this.hierarchyService.invalidateGraph();
		mutate("hierarchy:changed", () => {});
	}

	private trashEmptyAncestors(projectPath: string): void {
		let ancestorPath = projectPath.replace(/\/[^/]+$/, "");
		while (ancestorPath && ancestorPath !== projectPath) {
			const folder = this.app.vault.getAbstractFileByPath(ancestorPath);
			if (folder instanceof TFolder && folder.children.length === 0) {
				void this.app.vault.trash(folder, true);
				const next = ancestorPath.replace(/\/[^/]+$/, "");
				if (next === ancestorPath) break;
				ancestorPath = next;
			} else {
				break;
			}
		}
	}
}

function nameFromPath(path: string): string {
	return path.split("/").pop()?.replace(/\.md$/, "") ?? path;
}
