import { useSignal } from "@preact/signals";
import { useCallback } from "preact/hooks";

import { usePlugin } from "@true-recall/obsidian/preact";

import {
	consumeDragState,
	createDropDeps,
	type DragState,
	type DropResult,
	dragItemFromFlatItem,
	executeDrop,
	initDragTransfer,
	validateDrop,
} from "./drag-drop";
import type { FlatProjectItem } from "./project-tree-flatten";

export function useProjectDragDrop() {
	const plugin = usePlugin();
	const dragState = useSignal<DragState | null>(null);

	const handleDragStart = useCallback(
		(e: DragEvent, item: FlatProjectItem) => {
			const dragItem = dragItemFromFlatItem(item);
			if (!dragItem) {
				e.preventDefault();
				return;
			}
			initDragTransfer(e, dragItem, dragState);
		},
		[dragState],
	);

	const handleDragEnd = useCallback(() => {
		dragState.value = null;
	}, [dragState]);

	const handleDragOver = useCallback(
		(e: DragEvent, targetItem: FlatProjectItem) => {
			const ds = dragState.value;
			if (!ds) return;

			const targetPath =
				targetItem.type === "project-header"
					? targetItem.project.path
					: targetItem.type === "note"
						? targetItem.note.path
						: null;

			if (!targetPath || targetPath === ds.dropTargetPath) {
				if (ds.isValid) e.preventDefault();
				return;
			}

			const result = validateDrop(ds.item, targetItem, plugin.hierarchyService);

			dragState.value = {
				...ds,
				dropTargetPath: targetPath,
				isValid: result !== null,
			};

			if (result) {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			}
		},
		[dragState, plugin],
	);

	const handleDrop = useCallback(
		(e: DragEvent, targetItem: FlatProjectItem) => {
			const ds = consumeDragState(e, dragState);
			if (!ds) return;

			const result = validateDrop(ds.item, targetItem, plugin.hierarchyService);
			if (!result) return;

			void executeDrop(result, createDropDeps(plugin));
		},
		[dragState, plugin],
	);

	const unnestItem = useCallback(
		(ds: DragState) => {
			if (!ds.item.parentPath) return;
			const parentName = (
				ds.item.parentPath.split("/").pop() ?? ds.item.parentPath
			).replace(/\.md$/, "");

			const result: DropResult = {
				action: "unnest",
				dragPath: ds.item.path,
				dragName: ds.item.name,
				parentPath: ds.item.parentPath,
				parentName,
			};
			void executeDrop(result, createDropDeps(plugin));
		},
		[plugin],
	);

	const handleTopDrop = useCallback(
		(e: DragEvent) => {
			const ds = consumeDragState(e, dragState);
			if (!ds) return;

			if (ds.item.parentPath) {
				unnestItem(ds);
			} else {
				void plugin.projectManagement.convertToProject(ds.item.path);
			}
		},
		[dragState, plugin, unnestItem],
	);

	const handleBottomDrop = useCallback(
		(e: DragEvent) => {
			const ds = consumeDragState(e, dragState);
			if (!ds) return;

			if (ds.item.parentPath) {
				unnestItem(ds);
			} else {
				void plugin.projectManagement.setArchive(ds.item.path, true);
			}
		},
		[dragState, plugin, unnestItem],
	);

	return {
		dragState,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDrop,
		handleTopDrop,
		handleBottomDrop,
	};
}
