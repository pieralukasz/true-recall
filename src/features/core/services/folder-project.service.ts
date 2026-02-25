import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { type App, TFile, TFolder } from "obsidian";

export interface FolderProject {
	folderPath: string;
	folderNotePath: string | null;
	memberPaths: string[];
	childFolderPaths: string[];
}

export class FolderProjectService {
	private cache: FolderProject[] | null = null;

	constructor(
		private app: App,
		private frontmatterIndex: FrontmatterIndexService,
		private getSettings: () => TrueRecallSettings,
	) {}

	discoverFolderProjects(): FolderProject[] {
		if (this.cache) return this.cache;

		const settings = this.getSettings();
		if (!settings.folderProjectsEnabled) {
			this.cache = [];
			return this.cache;
		}

		// Collect all flashcard note paths grouped by parent folder
		const folderToMembers = new Map<string, string[]>();
		const allUids = this.frontmatterIndex.getAllValues("flashcard_uid");

		for (const uid of allUids) {
			const file = this.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				uid,
			);
			if (!file) continue;

			const folderPath = this.getParentFolderPath(file.path);
			if (folderPath === "") continue; // Skip root vault folder

			let members = folderToMembers.get(folderPath);
			if (!members) {
				members = [];
				folderToMembers.set(folderPath, members);
			}
			members.push(file.path);
		}

		const results: FolderProject[] = [];

		for (const [folderPath, memberPaths] of folderToMembers) {
			if (this.isExcluded(folderPath)) continue;

			const folderNotePath = this.getFolderNotePath(folderPath);

			// Check if Folder Note explicitly opts out
			if (folderNotePath) {
				const values = this.frontmatterIndex.getValues(
					"project",
					folderNotePath,
				);
				if (values.includes("false")) continue;
			}

			// Exclude Folder Note itself from members
			const filteredMembers = folderNotePath
				? memberPaths.filter((p) => p !== folderNotePath)
				: memberPaths;

			// Find child folders that are also in folderToMembers
			const childFolderPaths: string[] = [];
			for (const candidatePath of folderToMembers.keys()) {
				if (
					candidatePath !== folderPath &&
					candidatePath.startsWith(folderPath + "/") &&
					!this.hasIntermediateFolder(
						folderPath,
						candidatePath,
						folderToMembers,
					)
				) {
					childFolderPaths.push(candidatePath);
				}
			}

			results.push({
				folderPath,
				folderNotePath,
				memberPaths: filteredMembers,
				childFolderPaths,
			});
		}

		this.cache = results;
		return results;
	}

	getFolderFlashcardPaths(folderPath: string): string[] {
		const projects = this.discoverFolderProjects();
		const project = projects.find((p) => p.folderPath === folderPath);
		return project?.memberPaths ?? [];
	}

	getFolderNotePath(folderPath: string): string | null {
		const folderName = folderPath.split("/").pop() ?? folderPath;
		const candidatePath = `${folderPath}/${folderName}.md`;
		const file = this.app.vault.getAbstractFileByPath(candidatePath);
		if (file instanceof TFile) return candidatePath;
		// Fallback for test mocks
		if (file && typeof file === "object" && "extension" in file) {
			return candidatePath;
		}
		return null;
	}

	isExcluded(folderPath: string): boolean {
		const settings = this.getSettings();
		if (!settings.folderProjectsEnabled) return true;

		return settings.excludedFolders.some(
			(ex) => folderPath === ex || folderPath.startsWith(ex + "/"),
		);
	}

	getFolderPathForNote(notePath: string): string | null {
		const lastSlash = notePath.lastIndexOf("/");
		if (lastSlash === -1) return null;

		const folderPath = notePath.substring(0, lastSlash);
		const fileName = notePath.substring(lastSlash + 1).replace(/\.md$/, "");
		const folderName = folderPath.split("/").pop() ?? folderPath;

		if (fileName === folderName) return folderPath;
		return null;
	}

	isFolderProject(folderPath: string): boolean {
		const projects = this.discoverFolderProjects();
		return projects.some((p) => p.folderPath === folderPath);
	}

	invalidateCache(): void {
		this.cache = null;
	}

	private getParentFolderPath(filePath: string): string {
		const lastSlash = filePath.lastIndexOf("/");
		return lastSlash === -1 ? "" : filePath.substring(0, lastSlash);
	}

	/**
	 * Check if there's an intermediate folder-project between parent and child.
	 * e.g., for parent="Math" and child="Math/Algebra/Linear",
	 * returns true if "Math/Algebra" is also in the folder map.
	 */
	private hasIntermediateFolder(
		parentPath: string,
		childPath: string,
		folderMap: Map<string, string[]>,
	): boolean {
		const relativePath = childPath.substring(parentPath.length + 1);
		const parts = relativePath.split("/");

		// If child is a direct subfolder, no intermediate possible
		if (parts.length <= 1) return false;

		// Check each intermediate level
		let current = parentPath;
		for (let i = 0; i < parts.length - 1; i++) {
			current += "/" + parts[i];
			if (folderMap.has(current)) return true;
		}
		return false;
	}
}
