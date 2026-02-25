import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import type { FolderProjectService } from "@features/core/services/folder-project.service";
import type { App } from "obsidian";

export interface ProjectNode {
	path: string;
	name: string;
	children: ProjectNode[];
	memberPaths: string[];
}

export class ProjectLinkService {
	constructor(
		private app: App,
		private frontmatterIndex: FrontmatterIndexService,
		private folderProjectService?: FolderProjectService,
	) {}

	/** All note paths that have `project: true` in frontmatter */
	getAllProjectPaths(): string[] {
		const files = this.frontmatterIndex.getFilesByValue("project", "true");
		return files.map((f) => f.path);
	}

	/** Outgoing wiki links from a project note (direct members) */
	getMemberPaths(projectPath: string): string[] {
		// Folder-project path (not a .md file) → return folder flashcard paths
		if (!projectPath.endsWith(".md") && this.folderProjectService) {
			return this.folderProjectService.getFolderFlashcardPaths(
				projectPath,
			);
		}

		const linkMembers = this.getLinkMemberPaths(projectPath);

		// If this note is a Folder Note, also include folder flashcard notes
		if (this.folderProjectService) {
			const folderPath =
				this.folderProjectService.getFolderPathForNote(projectPath);
			if (folderPath) {
				const folderMembers =
					this.folderProjectService.getFolderFlashcardPaths(
						folderPath,
					);
				const allPaths = new Set([...linkMembers, ...folderMembers]);
				allPaths.delete(projectPath);
				return Array.from(allPaths);
			}
		}

		return linkMembers;
	}

	/**
	 * Members that are themselves projects → child projects.
	 * Useful for building hierarchy (e.g., "ML" project links to "Python" project).
	 */
	getChildProjects(projectPath: string): string[] {
		const members = this.getLinkMemberPaths(projectPath);
		const projectPaths = new Set(this.getAllProjectPaths());
		return members.filter((m) => projectPaths.has(m));
	}

	/** Which project notes link to a given note */
	getProjectsForNote(notePath: string): string[] {
		const projectPaths = this.getAllProjectPaths();
		return projectPaths.filter((pp) => {
			const resolved = this.app.metadataCache.resolvedLinks[pp];
			return resolved?.[notePath] !== undefined;
		});
	}

	/**
	 * Notes with flashcard_uid that are NOT linked from any project
	 * (including folder-based projects).
	 */
	getUnassignedPaths(): string[] {
		const projectPaths = this.getAllProjectPaths();

		// Collect all member paths across link-based projects
		const assigned = new Set<string>();
		for (const pp of projectPaths) {
			assigned.add(pp);
			for (const member of this.getMemberPaths(pp)) {
				assigned.add(member);
			}
		}

		// Also mark folder-project members as assigned
		if (this.folderProjectService) {
			const folderProjects =
				this.folderProjectService.discoverFolderProjects();
			for (const fp of folderProjects) {
				for (const member of fp.memberPaths) assigned.add(member);
				if (fp.folderNotePath) assigned.add(fp.folderNotePath);
			}
		}

		// Iterate all flashcard_uid values to find notes with flashcards
		const flashcardPaths = new Set<string>();
		const allUids = this.frontmatterIndex.getAllValues("flashcard_uid");
		for (const uid of allUids) {
			const file = this.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				uid,
			);
			if (file) flashcardPaths.add(file.path);
		}

		return Array.from(flashcardPaths).filter((p) => !assigned.has(p));
	}

	/**
	 * Build a hierarchical tree of all projects.
	 * Merges link-based projects with folder-based projects.
	 */
	buildHierarchy(): ProjectNode[] {
		const linkNodes = this.buildLinkHierarchy();
		const folderNodes = this.folderProjectService
			? this.buildFolderHierarchy()
			: [];

		if (folderNodes.length === 0) return linkNodes;

		return this.mergeHierarchies(linkNodes, folderNodes);
	}

	/**
	 * Get all source UIDs that belong to a project (direct members + recursive children).
	 * Handles both .md project paths and folder project paths.
	 */
	getSourceUidsForProject(
		projectPath: string,
		includeChildren = true,
	): Set<string> {
		// Folder-project path (not a .md file)
		if (!projectPath.endsWith(".md")) {
			return this.getSourceUidsForFolderProject(
				projectPath,
				includeChildren,
			);
		}

		const uids = new Set<string>();
		const visited = new Set<string>();

		const collect = (pp: string) => {
			if (visited.has(pp)) return;
			visited.add(pp);

			for (const memberPath of this.getMemberPaths(pp)) {
				const memberUids = this.frontmatterIndex.getValues(
					"flashcard_uid",
					memberPath,
				);
				for (const uid of memberUids) uids.add(uid);
			}

			if (includeChildren) {
				for (const child of this.getChildProjects(pp)) {
					collect(child);
				}

				// Also include folder-based children if this is a Folder Note
				if (this.folderProjectService) {
					const folderPath =
						this.folderProjectService.getFolderPathForNote(pp);
					if (folderPath) {
						this.collectFolderChildUids(
							folderPath,
							uids,
							new Set(),
						);
					}
				}
			}
		};

		collect(projectPath);
		return uids;
	}

	/** Raw wiki link members (no folder augmentation) */
	private getLinkMemberPaths(projectPath: string): string[] {
		const resolved = this.app.metadataCache.resolvedLinks[projectPath];
		if (!resolved) return [];
		return Object.keys(resolved).filter((p) => p.endsWith(".md"));
	}

	/** Build hierarchy from link-based projects only (original logic) */
	private buildLinkHierarchy(): ProjectNode[] {
		const projectPaths = this.getAllProjectPaths();
		const projectSet = new Set(projectPaths);

		const childOf = new Map<string, string[]>();
		for (const pp of projectPaths) {
			const children = this.getChildProjects(pp);
			childOf.set(pp, children);
		}

		const hasParent = new Set<string>();
		for (const children of childOf.values()) {
			for (const c of children) hasParent.add(c);
		}
		const roots = projectPaths.filter((pp) => !hasParent.has(pp));

		const buildNode = (path: string, visited: Set<string>): ProjectNode => {
			const file = this.app.vault.getAbstractFileByPath(path);
			const name = file?.name?.replace(/\.md$/, "") ?? path;
			const members = this.getLinkMemberPaths(path).filter(
				(m) => !projectSet.has(m),
			);

			const childProjects = (childOf.get(path) ?? []).filter(
				(c) => !visited.has(c),
			);
			visited.add(path);

			return {
				path,
				name,
				children: childProjects.map((c) => buildNode(c, visited)),
				memberPaths: members,
			};
		};

		return roots.map((r) => buildNode(r, new Set()));
	}

	/** Build hierarchy from folder-based projects */
	private buildFolderHierarchy(): ProjectNode[] {
		if (!this.folderProjectService) return [];

		const folderProjects =
			this.folderProjectService.discoverFolderProjects();
		if (folderProjects.length === 0) return [];

		const projectByFolder = new Map(
			folderProjects.map((fp) => [fp.folderPath, fp]),
		);

		// Find root folder-projects (not a child of any other folder-project)
		const childPaths = new Set<string>();
		for (const fp of folderProjects) {
			for (const child of fp.childFolderPaths) childPaths.add(child);
		}
		const roots = folderProjects.filter(
			(fp) => !childPaths.has(fp.folderPath),
		);

		const buildFolderNode = (folderPath: string): ProjectNode | null => {
			const fp = projectByFolder.get(folderPath);
			if (!fp) return null;

			const folderName =
				folderPath.split("/").pop() ?? folderPath;
			const path = fp.folderNotePath ?? folderPath;

			const children: ProjectNode[] = [];
			for (const childPath of fp.childFolderPaths) {
				const childNode = buildFolderNode(childPath);
				if (childNode) children.push(childNode);
			}

			return {
				path,
				name: folderName,
				memberPaths: fp.memberPaths,
				children,
			};
		};

		return roots
			.map((fp) => buildFolderNode(fp.folderPath))
			.filter((n): n is ProjectNode => n !== null);
	}

	/** Merge link-based and folder-based hierarchies, deduplicating overlaps */
	private mergeHierarchies(
		linkNodes: ProjectNode[],
		folderNodes: ProjectNode[],
	): ProjectNode[] {
		// Index all link-project nodes by path (flattened)
		const linkByPath = new Map<string, ProjectNode>();
		const collectLinkNodes = (nodes: ProjectNode[]) => {
			for (const n of nodes) {
				linkByPath.set(n.path, n);
				collectLinkNodes(n.children);
			}
		};
		collectLinkNodes(linkNodes);

		// Merge folder nodes into link nodes where they overlap
		const merged = [...linkNodes];

		for (const folderNode of folderNodes) {
			const existing = linkByPath.get(folderNode.path);
			if (existing) {
				// Folder Note also has project: true → merge members and children
				const memberSet = new Set([
					...existing.memberPaths,
					...folderNode.memberPaths,
				]);
				existing.memberPaths = Array.from(memberSet);
				existing.children = this.mergeChildNodes(
					existing.children,
					folderNode.children,
					linkByPath,
				);
			} else {
				merged.push(folderNode);
			}
		}

		return merged;
	}

	/** Merge two child arrays, deduplicating by path */
	private mergeChildNodes(
		linkChildren: ProjectNode[],
		folderChildren: ProjectNode[],
		linkByPath: Map<string, ProjectNode>,
	): ProjectNode[] {
		const childByPath = new Map<string, ProjectNode>();
		for (const c of linkChildren) childByPath.set(c.path, c);

		for (const fc of folderChildren) {
			const existing = childByPath.get(fc.path);
			if (existing) {
				const memberSet = new Set([
					...existing.memberPaths,
					...fc.memberPaths,
				]);
				existing.memberPaths = Array.from(memberSet);
				existing.children = this.mergeChildNodes(
					existing.children,
					fc.children,
					linkByPath,
				);
			} else if (!linkByPath.has(fc.path)) {
				childByPath.set(fc.path, fc);
			}
		}

		return Array.from(childByPath.values());
	}

	/** Collect UIDs from a folder-project and its child folders */
	private getSourceUidsForFolderProject(
		folderPath: string,
		includeChildren: boolean,
	): Set<string> {
		if (!this.folderProjectService) return new Set();

		const uids = new Set<string>();
		const visited = new Set<string>();

		const collect = (fp: string) => {
			if (visited.has(fp)) return;
			visited.add(fp);

			const members =
				this.folderProjectService!.getFolderFlashcardPaths(fp);
			for (const memberPath of members) {
				const memberUids = this.frontmatterIndex.getValues(
					"flashcard_uid",
					memberPath,
				);
				for (const uid of memberUids) uids.add(uid);
			}

			// Also collect UIDs from the Folder Note's wiki links
			const folderNotePath =
				this.folderProjectService!.getFolderNotePath(fp);
			if (folderNotePath) {
				const linkMembers = this.getLinkMemberPaths(folderNotePath);
				for (const memberPath of linkMembers) {
					const memberUids = this.frontmatterIndex.getValues(
						"flashcard_uid",
						memberPath,
					);
					for (const uid of memberUids) uids.add(uid);
				}
			}

			if (includeChildren) {
				const projects =
					this.folderProjectService!.discoverFolderProjects();
				const project = projects.find((p) => p.folderPath === fp);
				if (project) {
					for (const childPath of project.childFolderPaths) {
						collect(childPath);
					}
				}
			}
		};

		collect(folderPath);
		return uids;
	}

	/** Collect UIDs from child folder-projects (used when a Folder Note is also a link-project) */
	private collectFolderChildUids(
		folderPath: string,
		uids: Set<string>,
		visited: Set<string>,
	): void {
		if (!this.folderProjectService || visited.has(folderPath)) return;
		visited.add(folderPath);

		const projects = this.folderProjectService.discoverFolderProjects();
		const project = projects.find((p) => p.folderPath === folderPath);
		if (!project) return;

		for (const childPath of project.childFolderPaths) {
			const childMembers =
				this.folderProjectService.getFolderFlashcardPaths(childPath);
			for (const memberPath of childMembers) {
				const memberUids = this.frontmatterIndex.getValues(
					"flashcard_uid",
					memberPath,
				);
				for (const uid of memberUids) uids.add(uid);
			}
			this.collectFolderChildUids(childPath, uids, visited);
		}
	}
}
