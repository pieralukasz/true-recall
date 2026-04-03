import type { FrontmatterService } from "@true-recall/core/flashcard/source/frontmatter.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import { mutate } from "@true-recall/obsidian/data";
import type { App } from "obsidian";
import { Notice, normalizePath, TFile } from "obsidian";

export class ProjectManagementService {
	constructor(
		private app: App,
		private frontmatterService: FrontmatterService,
		private hierarchyService: HierarchyService,
	) {}

	async convertToProject(notePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return;

		await mutate("hierarchy:changed", () =>
			this.frontmatterService.markAsProject(file.path),
		);
		this.hierarchyService.invalidateGraph();

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

		this.hierarchyService.invalidateGraph();
		mutate("hierarchy:changed", () => {});
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

		this.hierarchyService.invalidateGraph();
		mutate("hierarchy:changed", () => {});
		new Notice(`Created sub-project "${name}" under "${parentName}"`);
	}
}
