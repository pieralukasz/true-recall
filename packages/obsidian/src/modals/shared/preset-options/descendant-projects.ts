/** The slice of HierarchyService the preset cascade needs. */
export interface HierarchyLookup {
	getDescendantPaths(nodePath: string): string[];
	getChildPaths(nodePath: string): string[];
	isExplicitProject(notePath: string): boolean;
}

/**
 * All descendant notes of `rootPath` that count as projects: nodes with
 * children of their own, or notes explicitly marked `project: true`. A leaf
 * project (no children yet) is still a project: testing "has children"
 * alone used to silently skip them from "Apply to child projects".
 */
export function getDescendantProjectPaths(
	hierarchy: HierarchyLookup,
	rootPath: string,
): string[] {
	return hierarchy
		.getDescendantPaths(rootPath)
		.filter(
			(path) =>
				hierarchy.getChildPaths(path).length > 0 ||
				hierarchy.isExplicitProject(path),
		);
}
