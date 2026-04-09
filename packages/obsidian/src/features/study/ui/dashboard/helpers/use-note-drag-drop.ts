import { useSignal } from "@preact/signals";
import { useCallback } from "preact/hooks";

import { usePlugin } from "@true-recall/obsidian/preact";

import type { DashboardNoteEntry } from "../types";
import {
	consumeDragState,
	createDropDeps,
	type DragState,
	type DropResult,
	executeDrop,
	initDragTransfer,
} from "./drag-drop";

export function useNoteDragDrop() {
	const plugin = usePlugin();
	const dragState = useSignal<DragState | null>(null);

	const handleDragStart = useCallback(
		(e: DragEvent, note: DashboardNoteEntry) => {
			if (!note.path) {
				e.preventDefault();
				return;
			}
			initDragTransfer(
				e,
				{ type: "note", path: note.path, name: note.name, parentPath: null },
				dragState,
			);
		},
		[dragState],
	);

	const handleDragEnd = useCallback(() => {
		dragState.value = null;
	}, [dragState]);

	const handleDragOver = useCallback(
		(e: DragEvent, targetNote: DashboardNoteEntry) => {
			const ds = dragState.value;
			if (!ds || !targetNote.path || targetNote.path === ds.item.path) return;

			if (targetNote.path !== ds.dropTargetPath) {
				dragState.value = {
					...ds,
					dropTargetPath: targetNote.path,
					isValid: true,
				};
			}

			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		},
		[dragState],
	);

	const handleDrop = useCallback(
		(e: DragEvent, targetNote: DashboardNoteEntry) => {
			const ds = consumeDragState(e, dragState);
			if (!ds || !targetNote.path || targetNote.path === ds.item.path) return;

			const result: DropResult = {
				action: "create-project",
				dragPath: ds.item.path,
				dragName: ds.item.name,
				targetPath: targetNote.path,
				targetName: targetNote.name,
			};

			void executeDrop(result, createDropDeps(plugin));
		},
		[dragState, plugin],
	);

	return {
		dragState,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDrop,
	};
}
