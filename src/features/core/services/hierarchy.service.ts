import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import type { App } from "obsidian";

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

export class HierarchyService {
	private graph: HierarchyGraph | null = null;

	constructor(
		private app: App,
		private frontmatterIndex: FrontmatterIndexService,
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
			const file = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
			if (file) flashcardPaths.add(file.path);
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
		const archivedFiles = this.frontmatterIndex.getFilesByValue(
			"archive",
			"true",
		);
		const uids = new Set<string>();

		for (const file of archivedFiles) {
			// Check if this archived note is a "project" (has children)
			const graph = this.ensureGraph();
			if (graph.childMap.has(file.path)) {
				// Archived project → collect all descendant UIDs
				const projectUids = this.getSourceUidsForProject(file.path, true);
				for (const uid of projectUids) uids.add(uid);
			} else {
				// Archived regular note → just its own UID
				const [uid] = this.frontmatterIndex.getValues(
					"flashcard_uid",
					file.path,
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

	// ─── Internal ────────────────────────────────────────

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
			const parentPath = this.resolveNameToPath(parentName);
			if (!parentPath) continue;

			const childFiles = this.frontmatterIndex.getFilesByValue(
				"parents",
				parentName,
			);
			for (const childFile of childFiles) {
				// Add edge: child → parent
				let parents = parentMap.get(childFile.path);
				if (!parents) {
					parents = new Set();
					parentMap.set(childFile.path, parents);
				}
				parents.add(parentPath);

				// Add edge: parent → child
				let children = childMap.get(parentPath);
				if (!children) {
					children = new Set();
					childMap.set(parentPath, children);
				}
				children.add(childFile.path);
			}
		}

		// Add implicit children from `include: folder` notes
		this.addFolderIncludes(parentMap, childMap);

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
		const file = this.app.metadataCache.getFirstLinkpathDest(name, "");
		return file?.path ?? null;
	}

	private breakCycles(
		parentMap: Map<string, Set<string>>,
		childMap: Map<string, Set<string>>,
	): void {
		// DFS cycle detection with three colors: white (unvisited), gray (in progress), black (done)
		const white = new Set<string>();
		const gray = new Set<string>();
		const black = new Set<string>();

		// Collect all nodes
		for (const path of parentMap.keys()) white.add(path);
		for (const path of childMap.keys()) white.add(path);

		const dfs = (node: string): void => {
			white.delete(node);
			gray.add(node);

			const children = childMap.get(node);
			if (children) {
				for (const child of [...children]) {
					if (gray.has(child)) {
						// Back-edge found → cycle. Break it.
						console.warn(
							`[HierarchyService] Cycle detected: ${node} → ${child}. Breaking edge.`,
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

	private addFolderIncludes(
		parentMap: Map<string, Set<string>>,
		childMap: Map<string, Set<string>>,
	): void {
		const includeFiles = this.frontmatterIndex.getFilesByValue(
			"include",
			"folder",
		);
		if (includeFiles.length === 0) return;

		const allFiles = this.app.vault.getMarkdownFiles();

		for (const folderNote of includeFiles) {
			const lastSlash = folderNote.path.lastIndexOf("/");
			const dir = lastSlash >= 0 ? folderNote.path.substring(0, lastSlash) : "";

			for (const file of allFiles) {
				if (file.path === folderNote.path) continue;

				const fileLastSlash = file.path.lastIndexOf("/");
				const fileDir =
					fileLastSlash >= 0 ? file.path.substring(0, fileLastSlash) : "";
				if (fileDir !== dir) continue;

				// Add bidirectional edge: file is child of folder note
				if (!parentMap.has(file.path)) {
					parentMap.set(file.path, new Set());
				}
				parentMap.get(file.path)?.add(folderNote.path);

				if (!childMap.has(folderNote.path)) {
					childMap.set(folderNote.path, new Set());
				}
				childMap.get(folderNote.path)?.add(file.path);
			}
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

		const file = this.app.vault.getAbstractFileByPath(path);
		const name =
			file?.name?.replace(/\.md$/, "") ?? path.split("/").pop() ?? path;

		const childPaths = graph.childMap.get(path);
		const nextAncestors = new Set(ancestors);
		nextAncestors.add(path);

		const children: HierarchyTreeNode[] = [];
		const memberPaths: string[] = [];

		if (childPaths) {
			for (const childPath of [...childPaths].sort()) {
				const childHasChildren = graph.childMap.has(childPath);
				if (childHasChildren) {
					// This child is itself a project → recurse
					const childNode = this.buildTreeNode(
						childPath,
						`${treePath}/${childPath}`,
						graph,
						nextAncestors,
					);
					if (childNode) children.push(childNode);
				} else {
					// Leaf node → member
					memberPaths.push(childPath);
				}
			}
		}

		return { path, name, treePath, children, memberPaths };
	}
}
