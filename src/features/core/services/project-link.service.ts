import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
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
	) {}

	/** All note paths that have `project: true` in frontmatter */
	getAllProjectPaths(): string[] {
		const files = this.frontmatterIndex.getFilesByValue("project", "true");
		return files.map((f) => f.path);
	}

	/** Outgoing wiki links from a project note (direct members) */
	getMemberPaths(projectPath: string): string[] {
		const resolved = this.app.metadataCache.resolvedLinks[projectPath];
		if (!resolved) return [];

		return Object.keys(resolved).filter((p) => p.endsWith(".md"));
	}

	/**
	 * Members that are themselves projects → child projects.
	 * Useful for building hierarchy (e.g., "ML" project links to "Python" project).
	 */
	getChildProjects(projectPath: string): string[] {
		const members = this.getMemberPaths(projectPath);
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
	 * Notes with flashcard_uid that are NOT linked from any project.
	 * Useful for "triage" — finding orphaned flashcard notes.
	 */
	getUnassignedPaths(): string[] {
		const projectPaths = this.getAllProjectPaths();

		// Collect all member paths across all projects
		const assigned = new Set<string>();
		for (const pp of projectPaths) {
			// Project notes themselves are considered "assigned"
			assigned.add(pp);
			for (const member of this.getMemberPaths(pp)) {
				assigned.add(member);
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

		// Notes with flashcards but not in any project
		return Array.from(flashcardPaths).filter((p) => !assigned.has(p));
	}

	/**
	 * Build a hierarchical tree of all projects.
	 * Root projects = projects not linked from any other project.
	 */
	buildHierarchy(): ProjectNode[] {
		const projectPaths = this.getAllProjectPaths();
		const projectSet = new Set(projectPaths);

		// Find which projects are children of other projects
		const childOf = new Map<string, string[]>();
		for (const pp of projectPaths) {
			const children = this.getChildProjects(pp);
			childOf.set(pp, children);
		}

		// A project is a "root" if no other project links to it
		const hasParent = new Set<string>();
		for (const children of childOf.values()) {
			for (const c of children) hasParent.add(c);
		}
		const roots = projectPaths.filter((pp) => !hasParent.has(pp));

		const buildNode = (path: string, visited: Set<string>): ProjectNode => {
			const file = this.app.vault.getAbstractFileByPath(path);
			const name = file?.name?.replace(/\.md$/, "") ?? path;
			const members = this.getMemberPaths(path).filter(
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

	/**
	 * Get all source UIDs that belong to a project (direct members + recursive children).
	 * Used to filter review queues by project.
	 */
	getSourceUidsForProject(
		projectPath: string,
		includeChildren = true,
	): Set<string> {
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
			}
		};

		collect(projectPath);
		return uids;
	}
}
