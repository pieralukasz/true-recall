import { describe, expect, it, vi } from "vitest";
import {
	getDragClass,
	dragItemFromFlatItem,
	validateDrop,
	type DragItem,
	type DragState,
} from "../../../src/features/study/ui/dashboard/helpers/drag-drop";
import type { FlatProjectItem } from "../../../src/features/study/ui/dashboard/helpers/project-tree-flatten";
import type { HierarchyService } from "../../../src/features/core/services/hierarchy.service";
import type {
	DashboardNoteEntry,
	DashboardProject,
} from "../../../src/features/study/ui/dashboard/types";

function makeNote(overrides: Partial<DashboardNoteEntry> = {}): DashboardNoteEntry {
	return {
		name: "Note",
		path: "notes/note.md",
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

function makeProject(overrides: Partial<DashboardProject> = {}): DashboardProject {
	return {
		name: "Project",
		path: "p/project",
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

function makeHierarchyService(
	childMap: Record<string, string[]> = {},
): HierarchyService {
	return {
		getChildPaths: vi.fn((path: string) => childMap[path] ?? []),
	} as unknown as HierarchyService;
}

// ── getDragClass ─────────────────────────────────────────

describe("getDragClass", () => {
	it("returns empty string when dragState is null", () => {
		expect(getDragClass(null, "some/path")).toBe("");
	});

	it("returns empty string when itemPath is null", () => {
		const state: DragState = {
			item: { type: "note", path: "a.md", name: "A", parentPath: null },
			dropTargetPath: null,
			isValid: false,
		};
		expect(getDragClass(state, null)).toBe("");
	});

	it("returns ep-drag-source for the dragged item", () => {
		const state: DragState = {
			item: { type: "note", path: "a.md", name: "A", parentPath: null },
			dropTargetPath: "b.md",
			isValid: true,
		};
		expect(getDragClass(state, "a.md")).toBe("ep-drag-source");
	});

	it("returns ep-drop-target for a valid drop target", () => {
		const state: DragState = {
			item: { type: "note", path: "a.md", name: "A", parentPath: null },
			dropTargetPath: "b.md",
			isValid: true,
		};
		expect(getDragClass(state, "b.md")).toBe("ep-drop-target");
	});

	it("returns empty string for drop target when not valid", () => {
		const state: DragState = {
			item: { type: "note", path: "a.md", name: "A", parentPath: null },
			dropTargetPath: "b.md",
			isValid: false,
		};
		expect(getDragClass(state, "b.md")).toBe("");
	});

	it("returns empty string for unrelated items", () => {
		const state: DragState = {
			item: { type: "note", path: "a.md", name: "A", parentPath: null },
			dropTargetPath: "b.md",
			isValid: true,
		};
		expect(getDragClass(state, "c.md")).toBe("");
	});
});

// ── dragItemFromFlatItem ─────────────────────────────────

describe("dragItemFromFlatItem", () => {
	it("extracts DragItem from project-header", () => {
		const item: FlatProjectItem = {
			type: "project-header",
			project: makeProject({ name: "Bio", path: "p/bio" }),
			depth: 0,
			isExpanded: false,
			parentPath: null,
		};
		expect(dragItemFromFlatItem(item)).toEqual({
			type: "project",
			path: "p/bio",
			name: "Bio",
			parentPath: null,
		});
	});

	it("extracts DragItem from note with path", () => {
		const item: FlatProjectItem = {
			type: "note",
			note: makeNote({ name: "Cell", path: "notes/cell.md" }),
			depth: 1,
			projectPath: "p/bio",
		};
		expect(dragItemFromFlatItem(item)).toEqual({
			type: "note",
			path: "notes/cell.md",
			name: "Cell",
			parentPath: "p/bio",
		});
	});

	it("returns null for note without path", () => {
		const item: FlatProjectItem = {
			type: "note",
			note: makeNote({ name: "Ghost", path: null }),
			depth: 1,
			projectPath: "p/bio",
		};
		expect(dragItemFromFlatItem(item)).toBeNull();
	});

	it("returns null for empty-project", () => {
		const item: FlatProjectItem = {
			type: "empty-project",
			depth: 1,
			projectPath: "p/empty",
		};
		expect(dragItemFromFlatItem(item)).toBeNull();
	});
});

// ── validateDrop ─────────────────────────────────────────

describe("validateDrop", () => {
	const hs = makeHierarchyService();

	it("note → project = reparent", () => {
		const drag: DragItem = { type: "note", path: "n/a.md", name: "A", parentPath: "p/old" };
		const target: FlatProjectItem = {
			type: "project-header",
			project: makeProject({ name: "New", path: "p/new" }),
			depth: 0,
			isExpanded: false,
			parentPath: null,
		};

		const result = validateDrop(drag, target, hs);
		expect(result).toEqual({
			action: "reparent",
			dragPath: "n/a.md",
			dragName: "A",
			oldParentPath: "p/old",
			newParentPath: "p/new",
			newParentName: "new",
		});
	});

	it("note → same parent project = null (no-op)", () => {
		const drag: DragItem = { type: "note", path: "n/a.md", name: "A", parentPath: "p/same" };
		const target: FlatProjectItem = {
			type: "project-header",
			project: makeProject({ name: "Same", path: "p/same" }),
			depth: 0,
			isExpanded: false,
			parentPath: null,
		};

		expect(validateDrop(drag, target, hs)).toBeNull();
	});

	it("note → note = create-project", () => {
		const drag: DragItem = { type: "note", path: "n/a.md", name: "A", parentPath: "p/x" };
		const target: FlatProjectItem = {
			type: "note",
			note: makeNote({ name: "B", path: "n/b.md" }),
			depth: 1,
			projectPath: "p/x",
		};

		const result = validateDrop(drag, target, hs);
		expect(result).toEqual({
			action: "create-project",
			dragPath: "n/a.md",
			dragName: "A",
			targetPath: "n/b.md",
			targetName: "B",
		});
	});

	it("drop on self = null", () => {
		const drag: DragItem = { type: "note", path: "n/a.md", name: "A", parentPath: null };
		const target: FlatProjectItem = {
			type: "note",
			note: makeNote({ name: "A", path: "n/a.md" }),
			depth: 1,
			projectPath: "p/x",
		};

		expect(validateDrop(drag, target, hs)).toBeNull();
	});

	it("project → descendant = null (cycle prevention)", () => {
		const hsWithChildren = makeHierarchyService({
			"p/parent": ["p/child"],
			"p/child": ["p/grandchild"],
		});

		const drag: DragItem = { type: "project", path: "p/parent", name: "Parent", parentPath: null };
		const target: FlatProjectItem = {
			type: "project-header",
			project: makeProject({ name: "Grandchild", path: "p/grandchild" }),
			depth: 2,
			isExpanded: false,
			parentPath: "p/child",
		};

		expect(validateDrop(drag, target, hsWithChildren)).toBeNull();
	});

	it("anything → empty-project = null", () => {
		const drag: DragItem = { type: "note", path: "n/a.md", name: "A", parentPath: null };
		const target: FlatProjectItem = {
			type: "empty-project",
			depth: 1,
			projectPath: "p/empty",
		};

		expect(validateDrop(drag, target, hs)).toBeNull();
	});

	it("target note without path = null", () => {
		const drag: DragItem = { type: "note", path: "n/a.md", name: "A", parentPath: null };
		const target: FlatProjectItem = {
			type: "note",
			note: makeNote({ name: "Ghost", path: null }),
			depth: 1,
			projectPath: "p/x",
		};

		expect(validateDrop(drag, target, hs)).toBeNull();
	});

	it("project → note = null (not supported)", () => {
		const drag: DragItem = { type: "project", path: "p/src", name: "Src", parentPath: null };
		const target: FlatProjectItem = {
			type: "note",
			note: makeNote({ name: "B", path: "n/b.md" }),
			depth: 1,
			projectPath: "p/x",
		};

		expect(validateDrop(drag, target, hs)).toBeNull();
	});
});
