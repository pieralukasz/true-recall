import { AnkiExportService } from "@true-recall/core/integration/anki/anki-export.service";
import { CsvExportService } from "@true-recall/core/integration/csv/csv-export.service";
import type { HierarchyTreeNode } from "@true-recall/core/services/notes/hierarchy.service";
import { ObsidianSourceUidResolver } from "@true-recall/obsidian/adapters/ObsidianSourceUidResolver";
import { ObsidianVaultMediaReader } from "@true-recall/obsidian/adapters/ObsidianVaultMediaReader";
import { mutate } from "@true-recall/obsidian/data";
import { downloadBlob } from "@true-recall/obsidian/features/integration/utils/export-helpers";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { NamePromptModal } from "@true-recall/obsidian/modals/study/NamePromptModal";
import { RenameModal } from "@true-recall/obsidian/modals/study/RenameModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import type { App } from "obsidian";
import { Notice, normalizePath, SuggestModal, TFile, TFolder } from "obsidian";
import { useCallback } from "preact/hooks";

export class ProjectSuggestModal extends SuggestModal<HierarchyTreeNode> {
	private resolve: ((node: HierarchyTreeNode | null) => void) | null = null;

	constructor(
		app: App,
		private nodes: HierarchyTreeNode[],
	) {
		super(app);
		this.setPlaceholder("Choose target project...");
	}

	openAndWait(): Promise<HierarchyTreeNode | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onClose(): void {
		this.resolve?.(null);
		this.resolve = null;
	}

	getSuggestions(query: string): HierarchyTreeNode[] {
		const q = query.toLowerCase();
		return q
			? this.nodes.filter((n) => n.name.toLowerCase().includes(q))
			: this.nodes;
	}

	renderSuggestion(item: HierarchyTreeNode, el: HTMLElement): void {
		el.setText(item.name);
	}

	onChooseSuggestion(item: HierarchyTreeNode): void {
		this.resolve?.(item);
		this.resolve = null;
	}
}

export function flattenNodes(nodes: HierarchyTreeNode[]): HierarchyTreeNode[] {
	const result: HierarchyTreeNode[] = [];
	const walk = (list: HierarchyTreeNode[]) => {
		for (const n of list) {
			result.push(n);
			walk(n.children);
		}
	};
	walk(nodes);
	return result;
}

export function useProjectActions() {
	const plugin = usePlugin();

	const handleArchive = useCallback(
		async (path: string, archived: boolean) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await mutate("hierarchy:changed", () =>
					plugin.flashcardManager
						.getFrontmatterService()
						.setArchive(file.path, archived),
				);
				plugin.hierarchyService.invalidateGraph();
			}
		},
		[plugin],
	);

	const handleRename = useCallback(
		async (path: string) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (!file) return;

			const modal = new RenameModal(plugin.app, file);
			const result = await modal.openAndWait();
			if (result.cancelled) return;

			const parent = file.parent?.path ?? "";
			const newName =
				file instanceof TFile
					? `${result.newName}.${file.extension}`
					: result.newName;
			const newPath = normalizePath(parent ? `${parent}/${newName}` : newName);

			if (plugin.app.vault.getAbstractFileByPath(newPath)) {
				new Notice(
					`A ${file instanceof TFolder ? "folder" : "file"} already exists at "${newPath}".`,
				);
				return;
			}

			await plugin.app.fileManager.renameFile(file, newPath);
		},
		[plugin],
	);

	const handleDissolve = useCallback(
		async (path: string) => {
			const childPaths = plugin.hierarchyService.getChildPaths(path);
			const isExplicit = plugin.hierarchyService.isExplicitProject(path);

			if (childPaths.length === 0 && !isExplicit) {
				new Notice("This project has no children.");
				return;
			}

			const projectName = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
			const subProjects = childPaths.filter(
				(cp) => plugin.hierarchyService.getChildPaths(cp).length > 0,
			);
			const subWarning =
				subProjects.length > 0
					? ` ${subProjects.length} sub-project${subProjects.length > 1 ? "s" : ""} will become root-level.`
					: "";
			const childMsg =
				childPaths.length > 0
					? `This will detach ${childPaths.length} note${childPaths.length > 1 ? "s" : ""} from "${projectName}". The notes and their cards will remain but become unassigned.${subWarning}`
					: `This will remove the project status from "${projectName}".`;
			const confirmed = await confirm(plugin.app, {
				title: "Dissolve project",
				message: childMsg,
				confirmLabel: "Dissolve",
			});
			if (!confirmed) return;

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			await mutate("hierarchy:changed", async () => {
				if (childPaths.length > 0) {
					await frontmatterService.dissolveProject(childPaths, projectName);
				}
				if (isExplicit) {
					await frontmatterService.unmarkProject(path);
				}
			});
			plugin.hierarchyService.invalidateGraph();
			new Notice(
				`Dissolved "${projectName}" — ${childPaths.length} notes detached.`,
			);
		},
		[plugin],
	);

	const handleMoveChildren = useCallback(
		async (path: string) => {
			const childPaths = plugin.hierarchyService.getChildPaths(path);
			if (childPaths.length === 0) {
				new Notice("This project has no children.");
				return;
			}

			const hierarchy = plugin.hierarchyService.buildHierarchy();
			const allNodes = flattenNodes(hierarchy).filter((n) => n.path !== path);
			if (allNodes.length === 0) {
				new Notice("No other projects available.");
				return;
			}

			const modal = new ProjectSuggestModal(plugin.app, allNodes);
			const target = await modal.openAndWait();
			if (!target) return;

			const fromName = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
			const confirmed = await confirm(plugin.app, {
				title: "Move children",
				message: `Move ${childPaths.length} note${childPaths.length > 1 ? "s" : ""} from "${fromName}" to "${target.name}"?`,
				confirmLabel: "Move",
			});
			if (!confirmed) return;

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			await mutate("hierarchy:changed", () =>
				frontmatterService.moveChildren(childPaths, fromName, target.name),
			);
			plugin.hierarchyService.invalidateGraph();
			new Notice(`Moved ${childPaths.length} notes to "${target.name}".`);
		},
		[plugin],
	);

	const handleDelete = useCallback(
		async (projectPath: string) => {
			const hierarchy = plugin.hierarchyService.buildHierarchy();
			const projectNode = findNode(hierarchy, projectPath);
			if (!projectNode) return;

			const allPaths = collectAllPaths(projectNode);
			const sourceUids =
				plugin.hierarchyService.getSourceUidsForProject(projectPath);

			const allCardIds: string[] = [];
			for (const uid of sourceUids) {
				const cards = plugin.cardStore.cards.getCardsBySourceUid(uid);
				for (const c of cards) allCardIds.push(c.id);
			}

			const projectName =
				projectPath.split("/").pop()?.replace(/\.md$/, "") ?? projectPath;
			const confirmed = await confirm(plugin.app, {
				title: "Delete project",
				message: `Permanently delete "${projectName}" with ${allPaths.length} note(s) and ${allCardIds.length} flashcard(s)? Notes will be moved to trash.`,
				confirmLabel: "Delete",
			});
			if (!confirmed) return;

			if (allCardIds.length > 0) {
				plugin.cardStore.cards.bulkSoftDelete(allCardIds);
			}

			for (const path of allPaths.reverse()) {
				const file = plugin.app.vault.getAbstractFileByPath(path);
				if (file) await plugin.app.vault.trash(file, true);
			}

			// Trash empty ancestor folders up the tree
			let ancestorPath = projectPath.replace(/\/[^/]+$/, "");
			while (ancestorPath && ancestorPath !== projectPath) {
				const folder = plugin.app.vault.getAbstractFileByPath(ancestorPath);
				if (folder instanceof TFolder && folder.children.length === 0) {
					await plugin.app.vault.trash(folder, true);
					const next = ancestorPath.replace(/\/[^/]+$/, "");
					if (next === ancestorPath) break;
					ancestorPath = next;
				} else {
					break;
				}
			}

			mutate("cards:bulk", () => {});
			plugin.hierarchyService.invalidateGraph();
			setTimeout(() => mutate("hierarchy:changed", () => {}), 100);

			new Notice(
				`Deleted "${projectName}" — ${allPaths.length} notes, ${allCardIds.length} cards.`,
			);
		},
		[plugin],
	);

	const handleExportAnki = useCallback(
		async (projectPath: string) => {
			const sourceUids =
				plugin.hierarchyService.getSourceUidsForProject(projectPath);
			if (sourceUids.size === 0) {
				new Notice("No cards to export.");
				return;
			}
			try {
				const exportService = new AnkiExportService(
					plugin.cardStore,
					plugin.fsrsService,
					new ObsidianSourceUidResolver(plugin.app),
					new ObsidianVaultMediaReader(plugin.app),
				);
				const { data, filename } = await exportService.exportApkg({
					exportMode: "notes",
					sourceUids: [...sourceUids],
					includeScheduling: true,
					includeMedia: true,
				});
				downloadBlob(data, filename);
				new Notice(`Exported to ${filename}`);
			} catch (err) {
				new Notice(
					`Export failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
		[plugin],
	);

	const handleExportCsv = useCallback(
		async (projectPath: string) => {
			const sourceUids =
				plugin.hierarchyService.getSourceUidsForProject(projectPath);
			if (sourceUids.size === 0) {
				new Notice("No cards to export.");
				return;
			}
			try {
				const csvService = new CsvExportService(
					plugin.cardStore,
					new ObsidianSourceUidResolver(plugin.app),
				);
				const { content, filename } = csvService.export({
					sourceUids: [...sourceUids],
					includeScheduling: true,
					separator: ",",
				});
				downloadBlob(content, filename, "text/csv;charset=utf-8");
				new Notice(`Exported to ${filename}`);
			} catch (err) {
				new Notice(
					`Export failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
		[plugin],
	);

	const handleCreateSubProject = useCallback(
		async (parentPath: string) => {
			const modal = new NamePromptModal(plugin.app, "New Sub-project");
			const result = await modal.openAndWait();
			if (result.cancelled) return;

			await plugin.projectManagement.createSubProject(result.name, parentPath);
		},
		[plugin],
	);

	const handleConvertToProject = useCallback(
		async (notePath: string) => {
			await plugin.projectManagement.convertToProject(notePath);
		},
		[plugin],
	);

	const handleAssignNoteToProject = useCallback(
		async (notePath: string) => {
			const hierarchy = plugin.hierarchyService.buildHierarchy();
			const allNodes = flattenNodes(hierarchy);
			if (allNodes.length === 0) {
				new Notice("No projects available. Create one first.");
				return;
			}

			const modal = new ProjectSuggestModal(plugin.app, allNodes);
			const target = await modal.openAndWait();
			if (!target) return;

			const file = plugin.app.vault.getAbstractFileByPath(notePath);
			if (file instanceof TFile) {
				await plugin.flashcardManager
					.getFrontmatterService()
					.addParent(file.path, target.name);
			}

			plugin.hierarchyService.invalidateGraph();
			mutate("hierarchy:changed", () => {});
			new Notice(`Assigned to "${target.name}"`);
		},
		[plugin],
	);

	return {
		handleArchive,
		handleRename,
		handleDissolve,
		handleMoveChildren,
		handleDelete,
		handleExportAnki,
		handleExportCsv,
		handleCreateSubProject,
		handleConvertToProject,
		handleAssignNoteToProject,
	};
}

function findNode(
	nodes: HierarchyTreeNode[],
	path: string,
): HierarchyTreeNode | null {
	for (const node of nodes) {
		if (node.path === path) return node;
		const found = findNode(node.children, path);
		if (found) return found;
	}
	return null;
}

function collectAllPaths(node: HierarchyTreeNode): string[] {
	const paths: string[] = [node.path, ...node.memberPaths];
	for (const child of node.children) {
		paths.push(...collectAllPaths(child));
	}
	return paths;
}
