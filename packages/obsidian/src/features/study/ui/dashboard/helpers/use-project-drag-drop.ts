import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
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

	const handleRootDrop = useCallback(
		(e: DragEvent) => {
			const ds = consumeDragState(e, dragState);
			if (!ds) return;

			if (ds.item.parentPath) {
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
			} else {
				// Unassigned note → create project
				const result: DropResult = {
					action: "create-project",
					dragPath: ds.item.path,
					dragName: ds.item.name,
					targetPath: ds.item.path,
					targetName: ds.item.name,
				};

				void executeDrop(result, createDropDeps(plugin));
			}
		},
		[dragState, plugin],
	);

	return {
		dragState,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDrop,
		handleRootDrop,
	};
}
