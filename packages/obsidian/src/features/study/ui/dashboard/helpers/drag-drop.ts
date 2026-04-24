import type { Signal } from "@preact/signals";
import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";

import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { NamePromptModal } from "@true-recall/obsidian/modals/study/NamePromptModal";
import type { ProjectManagementService } from "@true-recall/obsidian/services/project-management.service";

import type { FlatProjectItem } from "./project-tree-flatten";

export interface DragItem {
	type: "project" | "note";
	path: string;
	name: string;
	parentPath: string | null;
}

export type DropResult =
	| {
			action: "reparent";
			dragPath: string;
			dragName: string;
			oldParentPath: string | null;
			newParentPath: string;
			newParentName: string;
	  }
	| {
			action: "create-project";
			dragPath: string;
			dragName: string;
			targetPath: string;
			targetName: string;
	  }
	| {
			action: "unnest";
			dragPath: string;
			dragName: string;
			parentPath: string;
			parentName: string;
	  };

const DRAG_MIME = "application/x-true-recall-dnd";

export interface DragState {
	item: DragItem;
	dropTargetPath: string | null;
	isValid: boolean;
}

export function getDragClass(
	dragState: DragState | null,
	itemPath: string | null,
): string {
	if (!dragState || !itemPath) return "";
	if (dragState.item.path === itemPath) return "ep-drag-source";
	if (dragState.dropTargetPath === itemPath && dragState.isValid)
		return "ep-drop-target";
	return "";
}

export function initDragTransfer(
	e: DragEvent,
	item: DragItem,
	dragState: Signal<DragState | null>,
): void {
	e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(item));
	if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
	requestAnimationFrame(() => {
		dragState.value = { item, dropTargetPath: null, isValid: false };
	});
}

export function consumeDragState(
	e: DragEvent,
	dragState: Signal<DragState | null>,
): DragState | null {
	e.preventDefault();
	const ds = dragState.value;
	dragState.value = null;
	return ds;
}

interface DropDeps {
	app: App;
	projectManagement: ProjectManagementService;
	promptProjectName: (defaultName: string) => Promise<string | null>;
}

export function createDropDeps(plugin: TrueRecallPlugin): DropDeps {
	return {
		app: plugin.app,
		projectManagement: plugin.projectManagement,
		promptProjectName: async (defaultName: string) => {
			const modal = new NamePromptModal(plugin.app, defaultName);
			const res = await modal.openAndWait();
			return res.cancelled ? null : res.name;
		},
	};
}

export function dragItemFromFlatItem(item: FlatProjectItem): DragItem | null {
	if (item.type === "project-header") {
		return {
			type: "project",
			path: item.project.path,
			name: item.project.name,
			parentPath: item.parentPath,
		};
	}
	if (item.type === "note" && item.note.path) {
		return {
			type: "note",
			path: item.note.path,
			name: item.note.name,
			parentPath: item.projectPath,
		};
	}
	return null;
}

function nameFromPath(path: string): string {
	const last = path.split("/").pop() ?? path;
	return last.replace(/\.md$/, "");
}

function isDescendant(
	ancestorPath: string,
	candidatePath: string,
	hierarchyService: HierarchyService,
): boolean {
	const visited = new Set<string>();
	const queue = [ancestorPath];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		if (visited.has(current)) continue;
		visited.add(current);

		const children = hierarchyService.getChildPaths(current);
		for (const child of children) {
			if (child === candidatePath) return true;
			queue.push(child);
		}
	}
	return false;
}

export function validateDrop(
	drag: DragItem,
	target: FlatProjectItem,
	hierarchyService: HierarchyService,
): DropResult | null {
	if (target.type === "empty-project") return null;

	const targetPath =
		target.type === "project-header" ? target.project.path : target.note.path;

	if (!targetPath) return null;
	if (drag.path === targetPath) return null;

	const targetName = nameFromPath(targetPath);

	if (target.type === "project-header") {
		if (drag.parentPath === targetPath) return null;

		if (
			drag.type === "project" &&
			isDescendant(drag.path, targetPath, hierarchyService)
		) {
			return null;
		}

		return {
			action: "reparent",
			dragPath: drag.path,
			dragName: drag.name,
			oldParentPath: drag.parentPath,
			newParentPath: targetPath,
			newParentName: targetName,
		};
	}

	if (target.type === "note" && drag.type === "note") {
		return {
			action: "create-project",
			dragPath: drag.path,
			dragName: drag.name,
			targetPath,
			targetName: target.note.name,
		};
	}

	return null;
}

export async function executeDrop(
	result: DropResult,
	deps: DropDeps,
): Promise<void> {
	const { projectManagement } = deps;

	switch (result.action) {
		case "reparent": {
			await projectManagement.reparent(
				result.dragPath,
				result.oldParentPath,
				result.newParentName,
			);
			new Notice(`Moved "${result.dragName}" under "${result.newParentName}"`);
			break;
		}

		case "create-project": {
			const name = await deps.promptProjectName("New Project");
			if (!name) return;

			const targetFile = deps.app.vault.getAbstractFileByPath(
				result.targetPath,
			);
			if (!(targetFile instanceof TFile)) return;

			const folder = targetFile.parent?.path ?? "";
			const isSameNote = result.dragPath === result.targetPath;
			const childPaths = isSameNote
				? [result.dragPath]
				: [result.dragPath, result.targetPath];

			await projectManagement.createProjectWithChildren(
				name,
				folder,
				childPaths,
			);
			break;
		}

		case "unnest": {
			await projectManagement.detachFromProject(
				result.dragPath,
				result.parentName,
			);
			new Notice(`Moved "${result.dragName}" to root`);
			break;
		}
	}
}
