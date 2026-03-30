import type { HierarchyService } from "@true-recall/core/services/hierarchy.service";
import type { FrontmatterService } from "@true-recall/core/flashcard/frontmatter.service";
import type { App } from "obsidian";
import { Notice, normalizePath, TFile } from "obsidian";
import type { FlatProjectItem } from "./project-tree-flatten";

// ── DnD data types ──────────────────────────────────────

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

export const DRAG_MIME = "application/x-true-recall-dnd";

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

// ── Drag item extraction ────────────────────────────────

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

// ── Drop validation ─────────────────────────────────────

function nameFromPath(path: string): string {
	const last = path.split("/").pop() ?? path;
	return last.replace(/\.md$/, "");
}

/** BFS check: is candidatePath a descendant of ancestorPath? */
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
	// Can't drop on empty-project rows
	if (target.type === "empty-project") return null;

	const targetPath =
		target.type === "project-header" ? target.project.path : target.note.path;

	// Target must have a path
	if (!targetPath) return null;

	// Can't drop on yourself
	if (drag.path === targetPath) return null;

	const targetName = nameFromPath(targetPath);

	if (target.type === "project-header") {
		// Can't drop onto current parent (no-op)
		if (drag.parentPath === targetPath) return null;

		// Project onto project: check for cycles
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

	// Note onto note → create project
	if (target.type === "note" && drag.type === "note") {
		return {
			action: "create-project",
			dragPath: drag.path,
			dragName: drag.name,
			targetPath,
			targetName: target.note.name,
		};
	}

	// Project onto note → invalid for v1
	return null;
}

// ── Drop execution ──────────────────────────────────────

export interface DropDeps {
	app: App;
	frontmatterService: FrontmatterService;
	promptProjectName: (defaultName: string) => Promise<string | null>;
}

export async function executeDrop(
	result: DropResult,
	deps: DropDeps,
): Promise<void> {
	const { app, frontmatterService } = deps;

	switch (result.action) {
		case "reparent": {
			const file = app.vault.getAbstractFileByPath(result.dragPath);
			if (!(file instanceof TFile)) return;

			if (result.oldParentPath) {
				const oldParentName = nameFromPath(result.oldParentPath);
				await frontmatterService.removeParent(file.path, oldParentName);
			}
			await frontmatterService.addParent(file.path, result.newParentName);
			new Notice(`Moved "${result.dragName}" under "${result.newParentName}"`);
			break;
		}

		case "create-project": {
			const name = await deps.promptProjectName("New Project");
			if (!name) return;

			// Determine folder from target note's location
			const targetFile = app.vault.getAbstractFileByPath(result.targetPath);
			if (!(targetFile instanceof TFile)) return;

			const folder = targetFile.parent?.path ?? "";
			const projectPath = normalizePath(
				folder ? `${folder}/${name}.md` : `${name}.md`,
			);

			if (app.vault.getAbstractFileByPath(projectPath)) {
				new Notice(`A note already exists at "${projectPath}".`);
				return;
			}

			// Create project note (no frontmatter needed — children declare parents)
			await app.vault.create(projectPath, "");

			// Add parents to both notes
			const dragFile = app.vault.getAbstractFileByPath(result.dragPath);
			const targetFileForParent = app.vault.getAbstractFileByPath(
				result.targetPath,
			);

			if (dragFile instanceof TFile) {
				await frontmatterService.addParent(dragFile.path, name);
			}
			if (targetFileForParent instanceof TFile) {
				await frontmatterService.addParent(targetFileForParent.path, name);
			}

			new Notice(`Created project "${name}" with 2 notes`);
			break;
		}

		case "unnest": {
			const file = app.vault.getAbstractFileByPath(result.dragPath);
			if (!(file instanceof TFile)) return;

			await frontmatterService.removeParent(file.path, result.parentName);
			new Notice(`Moved "${result.dragName}" to root`);
			break;
		}
	}
}
