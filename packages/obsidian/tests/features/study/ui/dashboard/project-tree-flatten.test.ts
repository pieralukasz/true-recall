import { describe, expect, it } from "vitest";
import {
	collectMatchingPaths,
	flattenProjectTree,
	projectMatchesSearch,
} from "../../../../../src/features/study/ui/dashboard/helpers/project-tree-flatten";
import type {
	DashboardNoteEntry,
	DashboardProject,
} from "../../../../../src/features/study/ui/dashboard/types";

function makeNote(
	overrides: Partial<DashboardNoteEntry> = {},
): DashboardNoteEntry {
	return {
		name: "Note A",
		path: "notes/note-a.md",
		due: 0,
		newCount: 0,
		learning: 0,
		total: 5,
		lastReview: null,
		overdueDays: 0,
		overdueCount: 0,
		estimatedMinutes: 0,
		priority: "done",
		projects: [],
		...overrides,
	};
}

function makeProject(
	overrides: Partial<DashboardProject> = {},
): DashboardProject {
	return {
		name: "Project A",
		path: "projects/project-a",
		healthPct: 100,
		newCount: 0,
		learning: 0,
		due: 0,
		totalCards: 0,
		childCount: 0,
		lastReviewed: null,
		totalMembers: 0,
		memberNotes: [],
		children: [],
		...overrides,
	};
}

// ── projectMatchesSearch ─────────────────────────────────

describe("projectMatchesSearch", () => {
	it("matches on project name", () => {
		const project = makeProject({ name: "Biology" });
		expect(projectMatchesSearch(project, "bio")).toBe(true);
	});

	it("matches on member note name", () => {
		const project = makeProject({
			name: "Math",
			memberNotes: [makeNote({ name: "Calculus Intro" })],
		});
		expect(projectMatchesSearch(project, "calculus")).toBe(true);
	});

	it("matches in a child project", () => {
		const child = makeProject({ name: "Organic Chemistry", path: "p/organic" });
		const parent = makeProject({ name: "Science", children: [child] });
		expect(projectMatchesSearch(parent, "organic")).toBe(true);
	});

	it("returns false when nothing matches", () => {
		const project = makeProject({
			name: "History",
			memberNotes: [makeNote({ name: "WW2 Timeline" })],
		});
		expect(projectMatchesSearch(project, "physics")).toBe(false);
	});
});

// ── flattenProjectTree ───────────────────────────────────

describe("flattenProjectTree", () => {
	it("returns only the header when collapsed", () => {
		const project = makeProject({
			memberNotes: [makeNote()],
		});
		const result = flattenProjectTree([project], new Set(), "");
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("project-header");
	});

	it("returns header + notes when expanded", () => {
		const noteA = makeNote({
			name: "A",
			priority: "due",
			due: 3,
			learning: 1,
			newCount: 0,
		});
		const noteB = makeNote({
			name: "B",
			priority: "done",
			due: 0,
			learning: 0,
			newCount: 0,
		});
		const project = makeProject({
			path: "p/root",
			memberNotes: [noteB, noteA],
		});

		const result = flattenProjectTree([project], new Set(["p/root"]), "");

		expect(result).toHaveLength(3);
		expect(result[0].type).toBe("project-header");
		// Notes are sorted by priority — "due" before "done"
		expect(result[1].type).toBe("note");
		expect(
			(result[1] as { type: "note"; note: DashboardNoteEntry }).note.name,
		).toBe("A");
		expect(result[2].type).toBe("note");
		expect(
			(result[2] as { type: "note"; note: DashboardNoteEntry }).note.name,
		).toBe("B");
	});

	it("handles nested depths correctly", () => {
		const child = makeProject({
			name: "Child",
			path: "p/child",
			memberNotes: [makeNote({ name: "Child Note" })],
		});
		const parent = makeProject({
			name: "Parent",
			path: "p/parent",
			children: [child],
		});

		const expanded = new Set(["p/parent", "p/child"]);
		const result = flattenProjectTree([parent], expanded, "");

		expect(result).toHaveLength(3);
		// Parent header at depth 0
		expect(result[0]).toMatchObject({ type: "project-header", depth: 0 });
		// Child header at depth 1
		expect(result[1]).toMatchObject({ type: "project-header", depth: 1 });
		// Child note at depth 2
		expect(result[2]).toMatchObject({ type: "note", depth: 2 });
	});

	it("shows empty-project item when expanded project has no notes or children", () => {
		const project = makeProject({ path: "p/empty" });
		const result = flattenProjectTree([project], new Set(["p/empty"]), "");

		expect(result).toHaveLength(2);
		expect(result[0].type).toBe("project-header");
		expect(result[1]).toMatchObject({
			type: "empty-project",
			projectPath: "p/empty",
			depth: 1,
		});
	});

	it("filters notes by search query when expanded", () => {
		const noteA = makeNote({ name: "Alpha", priority: "due", due: 1 });
		const noteB = makeNote({ name: "Beta", priority: "due", due: 1 });
		const project = makeProject({
			path: "p/root",
			memberNotes: [noteA, noteB],
		});

		const result = flattenProjectTree([project], new Set(["p/root"]), "alpha");

		// Header + only the matching note
		expect(result).toHaveLength(2);
		expect(result[1].type).toBe("note");
		expect(
			(result[1] as { type: "note"; note: DashboardNoteEntry }).note.name,
		).toBe("Alpha");
	});

	it("excludes projects that do not match search", () => {
		const matching = makeProject({ name: "Biology", path: "p/bio" });
		const noMatch = makeProject({ name: "History", path: "p/hist" });
		const result = flattenProjectTree([matching, noMatch], new Set(), "bio");

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("project-header");
		expect(
			(result[0] as { type: "project-header"; project: DashboardProject })
				.project.name,
		).toBe("Biology");
	});
});

// ── collectMatchingPaths ─────────────────────────────────

describe("collectMatchingPaths", () => {
	it("returns paths of all matching projects including nested", () => {
		const grandchild = makeProject({ name: "Cell Biology", path: "p/cell" });
		const child = makeProject({
			name: "Genetics",
			path: "p/gen",
			children: [grandchild],
		});
		const parent = makeProject({
			name: "Science",
			path: "p/sci",
			children: [child],
		});

		const paths = collectMatchingPaths([parent], "cell");

		// "Cell Biology" matches directly, "Science" matches via descendant
		expect(paths.has("p/cell")).toBe(true);
		expect(paths.has("p/sci")).toBe(true);
		// "Genetics" also matches because its child matches
		expect(paths.has("p/gen")).toBe(true);
	});

	it("returns empty set when nothing matches", () => {
		const project = makeProject({ name: "History", path: "p/hist" });
		const paths = collectMatchingPaths([project], "quantum");
		expect(paths.size).toBe(0);
	});

	it("matches via member note names", () => {
		const project = makeProject({
			name: "Deck",
			path: "p/deck",
			memberNotes: [makeNote({ name: "Special Topic" })],
		});
		const paths = collectMatchingPaths([project], "special");
		expect(paths.has("p/deck")).toBe(true);
	});
});
