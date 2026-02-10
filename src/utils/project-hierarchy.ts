import type { FrontmatterIndexService } from "../services/core/frontmatter-index.service";

export interface ProjectGraph {
	childrenMap: Map<string, string[]>;
	parentMap: Map<string, string[]>;
	projectNames: Set<string>;
	roots: string[];
}

export function isProjectNote(basename: string, projects: string[]): boolean {
	return projects.includes(basename);
}

/**
 * Builds a directed graph of project relationships from frontmatter data.
 *
 * A note is a "project" if it self-references in its projects field
 * (e.g., Python.md has projects: ["Python", ...]).
 * If that project-note also lists another project, it becomes a child
 * of that parent project.
 */
export function buildProjectGraph(
	frontmatterIndex: FrontmatterIndexService
): ProjectGraph {
	const allProjectNames = frontmatterIndex.getAllValues("projects");
	const validProjects = new Set<string>();
	const parentMap = new Map<string, string[]>();
	const childrenMap = new Map<string, string[]>();

	for (const name of allProjectNames) {
		const files = frontmatterIndex.getFilesByValue("projects", name);
		// Find the file whose basename matches the project name (the "project note")
		const projectFile = files.find((f) => f.basename === name);
		if (!projectFile) continue;

		// Verify self-reference: the project note must list itself
		const fileProjects = frontmatterIndex.getValues("projects", projectFile.path);
		if (!isProjectNote(name, fileProjects)) continue;

		validProjects.add(name);

		// Other projects listed = parent projects
		const parents = fileProjects.filter(
			(p) => p !== name
		);
		parentMap.set(name, parents);
	}

	// Build childrenMap (inverse of parentMap), only for valid project parents
	for (const [child, parents] of parentMap) {
		for (const parent of parents) {
			if (!validProjects.has(parent)) continue;
			const children = childrenMap.get(parent);
			if (children) {
				children.push(child);
			} else {
				childrenMap.set(parent, [child]);
			}
		}
	}

	// Root projects: valid projects with no valid parents
	const roots: string[] = [];
	for (const name of validProjects) {
		const parents = parentMap.get(name) ?? [];
		const hasValidParent = parents.some((p) => validProjects.has(p));
		if (!hasValidParent) {
			roots.push(name);
		}
	}
	roots.sort((a, b) => a.localeCompare(b));

	return { childrenMap, parentMap, projectNames: validProjects, roots };
}

/**
 * Collects all descendant projects recursively with cycle protection.
 */
export function getDescendantProjects(
	projectName: string,
	childrenMap: Map<string, string[]>,
	visited: Set<string> = new Set()
): Set<string> {
	const result = new Set<string>();
	if (visited.has(projectName)) return result;
	visited.add(projectName);

	const children = childrenMap.get(projectName) ?? [];
	for (const child of children) {
		result.add(child);
		const grandchildren = getDescendantProjects(child, childrenMap, visited);
		for (const gc of grandchildren) {
			result.add(gc);
		}
	}

	return result;
}
