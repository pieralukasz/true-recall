import { describe, expect, it } from "vitest";

import {
	getDescendantProjectPaths,
	type HierarchyLookup,
} from "../../../src/modals/shared/preset-options/descendant-projects";

/**
 * Hierarchy under test:
 *
 * Root
 * ├── Mid (has a child → project)
 * │   └── Leaf Project (no children, project: true)
 * ├── Plain Note (no children, not a project)
 * └── Empty Project (no children, project: true)
 */
function hierarchy(): HierarchyLookup {
	const children: Record<string, string[]> = {
		Root: ["Mid", "Plain Note", "Empty Project"],
		Mid: ["Leaf Project"],
	};
	const explicitProjects = new Set(["Leaf Project", "Empty Project"]);

	const descendants = (path: string): string[] => {
		const out: string[] = [];
		for (const child of children[path] ?? []) {
			out.push(child, ...descendants(child));
		}
		return out;
	};

	return {
		getDescendantPaths: descendants,
		getChildPaths: (path) => children[path] ?? [],
		isExplicitProject: (path) => explicitProjects.has(path),
	};
}

describe("getDescendantProjectPaths", () => {
	it("includes nested projects and leaf projects, skips plain notes", () => {
		const paths = getDescendantProjectPaths(hierarchy(), "Root");
		expect(paths).toEqual(["Mid", "Leaf Project", "Empty Project"]);
	});

	it("includes an explicit project with no children of its own", () => {
		const paths = getDescendantProjectPaths(hierarchy(), "Mid");
		expect(paths).toEqual(["Leaf Project"]);
	});

	it("returns nothing when descendants are only plain notes", () => {
		const lookup: HierarchyLookup = {
			getDescendantPaths: () => ["Plain A", "Plain B"],
			getChildPaths: () => [],
			isExplicitProject: () => false,
		};
		expect(getDescendantProjectPaths(lookup, "Root")).toEqual([]);
	});
});
