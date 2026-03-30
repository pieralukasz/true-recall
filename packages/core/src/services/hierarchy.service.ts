import type { FrontmatterIndexService } from "./frontmatter-index.service";
import type { IFileSystem } from "../interfaces/file-system";

export interface HierarchyTreeNode {
	path: string;
	name: string;
	treePath: string;
	children: HierarchyTreeNode[];
	memberPaths: string[];
}

// Keep backward compatibility alias for consumers still importing ProjectNode
export type ProjectNode = HierarchyTreeNode;

interface HierarchyGraph {
	parentMap: Map<string, Set<string>>;
	childMap: Map<string, Set<string>>;
	roots: Set<string>;
}

/**
 * Resolve a link name to a file path.
 * Platform adapters can provide a custom implementation.
 */
export type LinkResolver = (name: string) => string | null;

export class HierarchyService {
	private graph: HierarchyGraph | null = null;

	constructor(
		private frontmatterIndex: FrontmatterIndexService,
		private fileSystem: IFileSystem,
		private resolveLinkPath?: LinkResolver,
	) {}

	invalidateGraph(): void {
		this.graph = null;
	}

	buildHierarchy(): HierarchyTreeNode[] {
		const graph = this.ensureGraph();

		const roots = [...graph.roots].sort();
		return roots
			.map((rootPath) =>
				this.buildTreeNode(rootPath, rootPath, graph, new Set()),
			)
			.filter((n): n is HierarchyTreeNode => n !== null);
	}

	getSourceUidsForProject(
		nodePath: string,
		includeChildren = true,
	): Set<string> {
		const graph = this.ensureGraph();
		const uids = new Set<string>();
		const visited = new Set<string>();

		const collect = (path: string) => {
			if (visited.has(path)) return;
			visited.add(path);

			// Collect this node's own UIDs
			const nodeUids = this.frontmatterIndex.getValues("flashcard_uid", path);
			for (const uid of nodeUids) uids.add(uid);

			// Collect children's UIDs
			const children = graph.childMap.get(path);
			if (!children) return;

			for (const childPath of children) {
				// Always collect the child's own UIDs
				const childUids = this.frontmatterIndex.getValues(
					"flashcard_uid",
					childPath,
				);
				for (const uid of childUids) uids.add(uid);

				if (includeChildren) {
					collect(childPath);
				}
			}
		};

		collect(nodePath);
		return uids;
	}

	getUnassignedPaths(): string[] {
		const graph = this.ensureGraph();

		// All notes with flashcard_uid
		const allUids = this.frontmatterIndex.getAllValues("flashcard_uid");
		const flashcardPaths = new Set<string>();
		for (const uid of allUids) {
			const path = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
			if (path) flashcardPaths.add(path);
		}

		// A note is "assigned" if it has parents or is itself a parent (root project)
		const assigned = new Set<string>();
		for (const path of graph.parentMap.keys()) assigned.add(path);
		for (const path of graph.childMap.keys()) assigned.add(path);

		return Array.from(flashcardPaths).filter((p) => !assigned.has(p));
	}

	getParentsForNote(notePath: string): string[] {
		const graph = this.ensureGraph();
		const parents = graph.parentMap.get(notePath);
		return parents ? [...parents] : [];
	}

	getChildPaths(nodePath: string): string[] {
		const graph = this.ensureGraph();
		const children = graph.childMap.get(nodePath);
		return children ? [...children] : [];
	}

	getArchivedSourceUids(): Set<string> {
		const archivedPaths = this.frontmatterIndex.getFilesByValue(
			"archive",
			"true",
		);
		const uids = new Set<string>();

		for (const filePath of archivedPaths) {
			// Check if this archived note is a "project" (has children)
			const graph = this.ensureGraph();
			if (graph.childMap.has(filePath)) {
				// Archived project -> collect all descendant UIDs
				const projectUids = this.getSourceUidsForProject(filePath, true);
				for (const uid of projectUids) uids.add(uid);
			} else {
				// Archived regular note -> just its own UID
				const [uid] = this.frontmatterIndex.getValues(
					"flashcard_uid",
					filePath,
				);
				if (uid) uids.add(uid);
			}
		}

		return uids;
	}

	isNoteArchived(notePath: string): boolean {
		const [val] = this.frontmatterIndex.getValues("archive", notePath);
		return val === "true";
	}

	isProjectArchived(projectPath: string): boolean {
		return this.isNoteArchived(projectPath);
	}

	// ---- Internal ----

	private ensureGraph(): HierarchyGraph {
		if (this.graph) return this.graph;
		this.graph = this.buildGraph();
		return this.graph;
	}

	private buildGraph(): HierarchyGraph {
		const parentMap = new Map<string, Set<string>>();
		const childMap = new Map<string, Set<string>>();

		// Scan all notes that have parents[] declared
		const allParentNames = this.frontmatterIndex.getAllValues("parents");

		// For each unique parent name, find all children that declare it
		for (const parentName of allParentNames) {
			const trimmed = parentName.trim();
			if (!trimmed) continue;
			const parentPath = this.resolveNameToPath(trimmed) ?? `${trimmed}.md`;

			const childPaths = this.frontmatterIndex.getFilesByValue(
				"parents",
				parentName,
			);
			for (const childPath of childPaths) {
				// Add edge: child -> parent
				let parents = parentMap.get(childPath);
				if (!parents) {
					parents = new Set();
					parentMap.set(childPath, parents);
				}
				parents.add(parentPath);

				// Add edge: parent -> child
				let children = childMap.get(parentPath);
				if (!children) {
					children = new Set();
					childMap.set(parentPath, children);
				}
				children.add(childPath);
			}
		}

		// Detect and break cycles
		this.breakCycles(parentMap, childMap);

		// Identify roots: nodes that have children but no parents themselves
		const roots = new Set<string>();
		for (const path of childMap.keys()) {
			if (!parentMap.has(path) || parentMap.get(path)?.size === 0) {
				roots.add(path);
			}
		}

		return { parentMap, childMap, roots };
	}

	private resolveNameToPath(name: string): string | null {
		if (this.resolveLinkPath) {
			return this.resolveLinkPath(name);
		}
		return null;
	}

	private breakCycles(
		parentMap: Map<string, Set<string>>,
		childMap: Map<string, Set<string>>,
	): void {
		const white = new Set<string>();
		const gray = new Set<string>();
		const black = new Set<string>();

		for (const path of parentMap.keys()) white.add(path);
		for (const path of childMap.keys()) white.add(path);

		const dfs = (node: string): void => {
			white.delete(node);
			gray.add(node);

			const children = childMap.get(node);
			if (children) {
				for (const child of [...children]) {
					if (gray.has(child)) {
						console.warn(
							`[HierarchyService] Cycle detected: ${node} -> ${child}. Breaking edge.`,
						);
						children.delete(child);
						const childParents = parentMap.get(child);
						if (childParents) childParents.delete(node);
					} else if (white.has(child)) {
						dfs(child);
					}
				}
			}

			gray.delete(node);
			black.add(node);
		};

		while (white.size > 0) {
			const node = white.values().next().value as string;
			dfs(node);
		}
	}

	private buildTreeNode(
		path: string,
		treePath: string,
		graph: HierarchyGraph,
		ancestors: Set<string>,
	): HierarchyTreeNode | null {
		// Prevent infinite recursion from any remaining cycles
		if (ancestors.has(path)) return null;

		const name =
			path.split("/").pop()?.replace(/\.md$/, "") ?? path;

		const childPaths = graph.childMap.get(path);
		const nextAncestors = new Set(ancestors);
		nextAncestors.add(path);

		const children: HierarchyTreeNode[] = [];
		const memberPaths: string[] = [];

		if (childPaths) {
			for (const childPath of [...childPaths].sort()) {
				const childHasChildren = graph.childMap.has(childPath);
				if (childHasChildren) {
					const childNode = this.buildTreeNode(
						childPath,
						`${treePath}/${childPath}`,
						graph,
						nextAncestors,
					);
					if (childNode) children.push(childNode);
				} else {
					memberPaths.push(childPath);
				}
			}
		}

		return { path, name, treePath, children, memberPaths };
	}
}
