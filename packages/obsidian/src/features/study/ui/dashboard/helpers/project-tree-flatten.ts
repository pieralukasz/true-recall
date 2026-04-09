import { prioritySortComparator } from "@true-recall/core/helpers/note-priority";

import type { DashboardNoteEntry, DashboardProject } from "../types";

export type FlatProjectItem =
	| {
			type: "project-header";
			project: DashboardProject;
			depth: number;
			isExpanded: boolean;
			parentPath: string | null;
	  }
	| {
			type: "note";
			note: DashboardNoteEntry;
			depth: number;
			projectPath: string;
	  }
	| {
			type: "empty-project";
			depth: number;
			projectPath: string;
	  };

export function projectMatchesSearch(
	project: DashboardProject,
	query: string,
): boolean {
	if (project.name.toLowerCase().includes(query)) return true;
	if (project.memberNotes.some((n) => n.name.toLowerCase().includes(query)))
		return true;
	return project.children.some((c) => projectMatchesSearch(c, query));
}

export function flattenProjectTree(
	projects: DashboardProject[],
	expandedPaths: ReadonlySet<string>,
	searchQuery: string,
): FlatProjectItem[] {
	const result: FlatProjectItem[] = [];
	const query = searchQuery.toLowerCase();

	function walk(
		project: DashboardProject,
		depth: number,
		parentPath: string | null,
	) {
		const isExpanded = expandedPaths.has(project.path);
		result.push({
			type: "project-header",
			project,
			depth,
			isExpanded,
			parentPath,
		});

		if (!isExpanded) return;

		// Sub-projects first (like Anki sub-decks above cards)
		for (const child of project.children) {
			walk(child, depth + 1, project.path);
		}

		const notes = query
			? project.memberNotes.filter((n) => n.name.toLowerCase().includes(query))
			: project.memberNotes;
		const sorted = [...notes].sort(prioritySortComparator);

		for (const note of sorted) {
			result.push({
				type: "note",
				note,
				depth: depth + 1,
				projectPath: project.path,
			});
		}

		if (sorted.length === 0 && project.children.length === 0) {
			result.push({
				type: "empty-project",
				depth: depth + 1,
				projectPath: project.path,
			});
		}
	}

	const filtered = query
		? projects.filter((p) => projectMatchesSearch(p, query))
		: projects;

	for (const project of filtered) {
		walk(project, 0, null);
	}

	return result;
}

export function collectMatchingPaths(
	projects: DashboardProject[],
	searchQuery: string,
): Set<string> {
	const paths = new Set<string>();
	const query = searchQuery.toLowerCase();

	function walk(project: DashboardProject) {
		if (projectMatchesSearch(project, query)) {
			paths.add(project.path);
		}
		for (const child of project.children) {
			walk(child);
		}
	}

	for (const project of projects) {
		walk(project);
	}

	return paths;
}
