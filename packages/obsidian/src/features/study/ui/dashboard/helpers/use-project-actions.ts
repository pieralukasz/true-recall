import type { HierarchyTreeNode } from "@true-recall/core/services/notes/hierarchy.service";
import { mutate } from "@true-recall/obsidian/data";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
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
		(path: string, archived: boolean) => {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				void plugin.flashcardManager
					.getFrontmatterService()
					.setArchive(file.path, archived);
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
			if (childPaths.length === 0) {
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
			const confirmed = await confirm(plugin.app, {
				title: "Dissolve project",
				message: `This will detach ${childPaths.length} note${childPaths.length > 1 ? "s" : ""} from "${projectName}". The notes and their cards will remain but become unassigned.${subWarning}`,
				confirmLabel: "Dissolve",
			});
			if (!confirmed) return;

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			await mutate("hierarchy:changed", () =>
				frontmatterService.dissolveProject(childPaths, projectName),
			);
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

	return { handleArchive, handleRename, handleDissolve, handleMoveChildren };
}
