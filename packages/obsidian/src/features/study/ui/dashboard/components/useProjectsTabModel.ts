import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import type { RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";

import { usePlugin } from "@true-recall/obsidian/preact";

import {
	collectMatchingPaths,
	flattenProjectTree,
} from "../helpers/project-tree-flatten";
import { useNoteBulkActions } from "../helpers/use-note-bulk-actions";
import { useNoteSelection } from "../helpers/use-note-selection";
import { useProjectActions } from "../helpers/use-project-actions";
import { useProjectDragDrop } from "../helpers/use-project-drag-drop";
import { useProjectScheduling } from "../helpers/use-project-scheduling";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import type { DashboardProject } from "../types";

export type ProjectActions = ReturnType<typeof useProjectActions> &
	ReturnType<typeof useProjectScheduling>;
export type ProjectDragDrop = ReturnType<typeof useProjectDragDrop>;
export function useProjectsTabModel({
	projects,
	searchQuery,
	scrollContainerRef,
	scrollTop,
}: {
	projects: DashboardProject[];
	searchQuery: string;
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
}) {
	const plugin = usePlugin();
	const expandedPaths = useSignal<ReadonlySet<string>>(new Set());
	const contentRef = useRef<HTMLDivElement>(null);
	const actions: ProjectActions = {
		...useProjectActions(),
		...useProjectScheduling(),
	};
	const drag = useProjectDragDrop();
	useEffect(() => {
		if (searchQuery)
			expandedPaths.value = collectMatchingPaths(projects, searchQuery);
	}, [searchQuery, projects, expandedPaths]);
	const flatItems = useMemo(
		() => flattenProjectTree(projects, expandedPaths.value, searchQuery),
		[projects, expandedPaths.value, searchQuery],
	);
	const allNotes = useMemo(
		() =>
			flatItems.filter((item) => item.type === "note").map((item) => item.note),
		[flatItems],
	);
	const selection = useNoteSelection({ filteredNotes: allNotes });
	const bulk = useNoteBulkActions({
		selectedPaths: selection.selectedPaths,
		filteredNotes: allNotes,
		exitSelection: selection.exitSelection,
	});
	const { totalHeight, virtualItems } = useExternalVirtualList({
		items: flatItems,
		scrollContainerRef,
		scrollTop,
		contentOffsetRef: contentRef,
	});
	const toggleExpand = useCallback(
		(path: string) => {
			const next = new Set(expandedPaths.value);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			expandedPaths.value = next;
		},
		[expandedPaths],
	);
	return {
		plugin,
		actions,
		drag,
		selection,
		bulk,
		flatItems,
		contentRef,
		totalHeight,
		virtualItems,
		toggleExpand,
	};
}
export type ProjectsTabModel = ReturnType<typeof useProjectsTabModel>;
