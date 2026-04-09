import { useSignal } from "@preact/signals";
import { useCallback, useEffect } from "preact/hooks";

import type { DashboardNoteEntry } from "../types";

function toggleSetItem<T>(set: ReadonlySet<T>, item: T): ReadonlySet<T> {
	const next = new Set(set);
	if (next.has(item)) next.delete(item);
	else next.add(item);
	return next;
}

export function useNoteSelection({
	filteredNotes,
}: {
	filteredNotes: DashboardNoteEntry[];
}) {
	const selectionMode = useSignal(false);
	const selectedPaths = useSignal<ReadonlySet<string>>(new Set());

	const exitSelection = useCallback(() => {
		selectionMode.value = false;
		selectedPaths.value = new Set();
	}, [selectionMode, selectedPaths]);

	useEffect(() => {
		if (!selectionMode.value) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") exitSelection();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [selectionMode.value, exitSelection]);

	const toggleSelect = useCallback(
		(path: string) => {
			selectedPaths.value = toggleSetItem(selectedPaths.value, path);
		},
		[selectedPaths],
	);

	const enterSelection = useCallback(
		(path: string) => {
			selectionMode.value = true;
			selectedPaths.value = new Set([path]);
		},
		[selectionMode, selectedPaths],
	);

	const selectAll = useCallback(() => {
		selectedPaths.value = new Set(
			filteredNotes.filter((n) => n.path).map((n) => n.path as string),
		);
	}, [filteredNotes, selectedPaths]);

	return {
		selectedPaths,
		selectedCount: selectedPaths.value.size,
		isSelecting: selectionMode.value,
		exitSelection,
		toggleSelect,
		enterSelection,
		selectAll,
	};
}
