import { describe, it, expect } from "vitest";
import {
	isProjectNote,
	buildProjectGraph,
	getDescendantProjects,
} from "../../src/utils/project-hierarchy";
import type { FrontmatterIndexService } from "../../src/services/core/frontmatter-index.service";

function createMockIndex(
	data: Record<string, string[]>
): FrontmatterIndexService {
	// data: { "NoteName": ["project1", "project2"] }
	// Builds a mock FrontmatterIndexService
	const allValues = new Set<string>();
	const valueToFiles = new Map<string, { basename: string; path: string }[]>();

	for (const [noteName, projects] of Object.entries(data)) {
		const file = { basename: noteName, path: `${noteName}.md` };
		for (const project of projects) {
			allValues.add(project);
			const existing = valueToFiles.get(project) ?? [];
			existing.push(file);
			valueToFiles.set(project, existing);
		}
	}

	return {
		getAllValues: (field: string) => {
			if (field === "projects") return allValues;
			return new Set<string>();
		},
		getFilesByValue: (field: string, value: string) => {
			if (field === "projects") return valueToFiles.get(value) ?? [];
			return [];
		},
		getValues: (field: string, path: string) => {
			if (field !== "projects") return [];
			const noteName = path.replace(".md", "");
			return data[noteName] ?? [];
		},
	} as unknown as FrontmatterIndexService;
}

describe("isProjectNote", () => {
	it("returns true when basename is in projects array", () => {
		expect(isProjectNote("Python", ["Python", "Programowanie"])).toBe(true);
	});

	it("returns false when basename is not in projects array", () => {
		expect(isProjectNote("flask", ["Python"])).toBe(false);
	});

	it("returns false for empty projects", () => {
		expect(isProjectNote("Python", [])).toBe(false);
	});
});

describe("buildProjectGraph", () => {
	it("handles flat projects (no hierarchy)", () => {
		const index = createMockIndex({
			// "Python" note with self-ref only
			Python: ["Python"],
			Django: ["Django"],
			flask: ["Python"], // regular note, not a project
		});

		const graph = buildProjectGraph(index);

		expect(graph.projectNames).toEqual(new Set(["Python", "Django"]));
		expect(graph.roots).toEqual(["Django", "Python"]);
		expect(graph.childrenMap.size).toBe(0);
	});

	it("builds simple parent-child hierarchy", () => {
		const index = createMockIndex({
			Programowanie: ["Programowanie"],
			Python: ["Python", "Programowanie"],
			flask: ["Python"],
		});

		const graph = buildProjectGraph(index);

		expect(graph.projectNames).toEqual(
			new Set(["Programowanie", "Python"])
		);
		expect(graph.roots).toEqual(["Programowanie"]);
		expect(graph.childrenMap.get("Programowanie")).toEqual(["Python"]);
		expect(graph.parentMap.get("Python")).toEqual(["Programowanie"]);
	});

	it("builds multi-level hierarchy (A → B → C)", () => {
		const index = createMockIndex({
			A: ["A"],
			B: ["B", "A"],
			C: ["C", "B"],
		});

		const graph = buildProjectGraph(index);

		expect(graph.roots).toEqual(["A"]);
		expect(graph.childrenMap.get("A")).toEqual(["B"]);
		expect(graph.childrenMap.get("B")).toEqual(["C"]);
		expect(graph.parentMap.get("C")).toEqual(["B"]);
	});

	it("handles multi-parent graph (D belongs to A and B)", () => {
		const index = createMockIndex({
			A: ["A"],
			B: ["B"],
			D: ["D", "A", "B"],
		});

		const graph = buildProjectGraph(index);

		expect(graph.roots.sort()).toEqual(["A", "B"]);
		expect(graph.childrenMap.get("A")).toEqual(["D"]);
		expect(graph.childrenMap.get("B")).toEqual(["D"]);
		expect(graph.parentMap.get("D")?.sort()).toEqual(["A", "B"]);
	});

	it("handles cycles (A → B → A) without crashing", () => {
		const index = createMockIndex({
			A: ["A", "B"],
			B: ["B", "A"],
		});

		const graph = buildProjectGraph(index);

		// Both have valid parents, so neither is root
		// But cycle detection in roots: both have valid parents
		expect(graph.projectNames).toEqual(new Set(["A", "B"]));
		expect(graph.roots).toEqual([]);
		expect(graph.childrenMap.get("A")).toEqual(["B"]);
		expect(graph.childrenMap.get("B")).toEqual(["A"]);
	});

	it("ignores invalid parent references", () => {
		const index = createMockIndex({
			Python: ["Python", "NonExistent"],
		});

		const graph = buildProjectGraph(index);

		// "NonExistent" is not a valid project (no self-ref note)
		expect(graph.projectNames).toEqual(new Set(["Python"]));
		expect(graph.roots).toEqual(["Python"]);
		expect(graph.parentMap.get("Python")).toEqual(["NonExistent"]);
	});

	it("skips notes without self-reference", () => {
		const index = createMockIndex({
			// "Python" note does NOT self-reference — it's just a member of Programowanie
			Python: ["Programowanie"],
			Programowanie: ["Programowanie"],
		});

		const graph = buildProjectGraph(index);

		// Only "Programowanie" is a valid project
		expect(graph.projectNames).toEqual(new Set(["Programowanie"]));
		expect(graph.roots).toEqual(["Programowanie"]);
	});
});

describe("getDescendantProjects", () => {
	it("returns empty for leaf project", () => {
		const childrenMap = new Map<string, string[]>();
		const result = getDescendantProjects("A", childrenMap);
		expect(result.size).toBe(0);
	});

	it("returns direct children", () => {
		const childrenMap = new Map([["A", ["B", "C"]]]);
		const result = getDescendantProjects("A", childrenMap);
		expect(result).toEqual(new Set(["B", "C"]));
	});

	it("returns transitive descendants", () => {
		const childrenMap = new Map([
			["A", ["B"]],
			["B", ["C"]],
		]);
		const result = getDescendantProjects("A", childrenMap);
		expect(result).toEqual(new Set(["B", "C"]));
	});

	it("handles cycles without infinite loop", () => {
		const childrenMap = new Map([
			["A", ["B"]],
			["B", ["A"]],
		]);
		const result = getDescendantProjects("A", childrenMap);
		// A→B→A cycle: B is a descendant, A appears as B's child (harmless)
		expect(result).toEqual(new Set(["B", "A"]));
	});

	it("handles diamond-shaped graph (A→B, A→C, B→D, C→D)", () => {
		const childrenMap = new Map([
			["A", ["B", "C"]],
			["B", ["D"]],
			["C", ["D"]],
		]);
		const result = getDescendantProjects("A", childrenMap);
		expect(result).toEqual(new Set(["B", "C", "D"]));
	});
});
