import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IFileSystem } from "../../../src/interfaces/file-system";
import type { IMetadataIndex } from "../../../src/interfaces/metadata-index";
import { FrontmatterIndexService } from "../../../src/services/notes/frontmatter-index.service";
import { HierarchyService } from "../../../src/services/notes/hierarchy.service";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function createMockMetadataIndex(
	fileData: Map<string, Record<string, unknown>>,
): IMetadataIndex {
	return {
		getPathByFieldValue: vi.fn((field: string, value: string) => {
			for (const [path, fm] of fileData) {
				if (getNestedValue(fm, field) === value) return path;
			}
			return null;
		}),
		getFieldValue: vi.fn((path: string, field: string) => {
			const fm = fileData.get(path);
			if (!fm) return undefined;
			return getNestedValue(fm, field);
		}),
		getAllPathsWithField: vi.fn((field: string) => {
			const result = new Map<string, unknown>();
			for (const [path, fm] of fileData) {
				const val = getNestedValue(fm, field);
				if (val !== undefined && val !== null) {
					result.set(path, val);
				}
			}
			return result;
		}),
		onFieldChange: vi.fn(() => () => {}),
	};
}

describe("HierarchyService", () => {
	let fileData: Map<string, Record<string, unknown>>;
	let frontmatterIndex: FrontmatterIndexService;
	let service: HierarchyService;

	function addMockFile(
		path: string,
		frontmatter?: Record<string, unknown>,
	): void {
		fileData.set(path, frontmatter ?? {});
	}

	beforeEach(() => {
		fileData = new Map();

		const metadataIndex = createMockMetadataIndex(fileData);

		frontmatterIndex = new FrontmatterIndexService(metadataIndex);
		frontmatterIndex.register({
			field: "parents",
			type: "array",
			unique: false,
		});
		frontmatterIndex.register({
			field: "flashcard_uid",
			type: "string",
			unique: true,
		});
		frontmatterIndex.register({
			field: "archive",
			type: "string",
			unique: false,
		});
		frontmatterIndex.register({
			field: "include",
			type: "string",
			unique: false,
		});
		frontmatterIndex.register({
			field: "project",
			type: "string",
			unique: false,
		});

		const mockFileSystem: IFileSystem = {
			read: vi.fn(async () => ""),
			write: vi.fn(async () => {}),
			delete: vi.fn(async () => {}),
			listMarkdownFiles: vi.fn(async () => [...fileData.keys()]),
			watch: vi.fn(() => () => {}),
		};

		// Link resolver: resolve "[[Name]]" → "Name.md" or "Folder/Name.md"
		const resolveLinkPath = (name: string): string | null => {
			// Try exact path first
			if (fileData.has(`${name}.md`)) return `${name}.md`;
			// Try matching by basename (for paths like "Folder/Name.md")
			for (const path of fileData.keys()) {
				const basename = path.split("/").pop()?.replace(/\.md$/, "");
				if (basename === name) return path;
			}
			return null;
		};

		service = new HierarchyService(
			frontmatterIndex,
			mockFileSystem,
			resolveLinkPath,
		);
	});

	describe("buildHierarchy", () => {
		it("builds a tree from parents declarations", () => {
			addMockFile("ML.md", {});
			addMockFile("Basics.md", {
				parents: ["[[ML]]"],
				flashcard_uid: "uid-1",
			});
			addMockFile("Advanced.md", {
				parents: ["[[ML]]"],
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();

			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("ML.md");
			expect(hierarchy[0]?.name).toBe("ML");
			expect(hierarchy[0]?.memberPaths).toContain("Basics.md");
			expect(hierarchy[0]?.memberPaths).toContain("Advanced.md");
		});

		it("builds nested hierarchy", () => {
			addMockFile("ML.md", {});
			addMockFile("Python.md", { parents: ["[[ML]]"] });
			addMockFile("Basics.md", {
				parents: ["[[Python]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();

			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("ML.md");
			expect(hierarchy[0]?.children).toHaveLength(1);
			expect(hierarchy[0]?.children[0]?.path).toBe("Python.md");
			expect(hierarchy[0]?.children[0]?.memberPaths).toContain("Basics.md");
		});

		it("handles multiple root projects", () => {
			addMockFile("ML.md", {});
			addMockFile("Biology.md", {});
			addMockFile("Note1.md", {
				parents: ["[[ML]]"],
				flashcard_uid: "uid-1",
			});
			addMockFile("Note2.md", {
				parents: ["[[Biology]]"],
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(2);
			const names = hierarchy.map((h) => h.name).sort();
			expect(names).toEqual(["Biology", "ML"]);
		});

		it("supports polyhierarchy (note under multiple parents)", () => {
			addMockFile("ML.md", {});
			addMockFile("Biology.md", {});
			addMockFile("Algorithms.md", {
				parents: ["[[ML]]", "[[Biology]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(2);

			const ml = hierarchy.find((h) => h.name === "ML");
			const bio = hierarchy.find((h) => h.name === "Biology");
			expect(ml?.memberPaths).toContain("Algorithms.md");
			expect(bio?.memberPaths).toContain("Algorithms.md");
		});

		it("generates unique treePaths for polyhierarchy nodes", () => {
			addMockFile("ML.md", {});
			addMockFile("Biology.md", {});
			addMockFile("Shared.md", {
				parents: ["[[ML]]", "[[Biology]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy[0]?.treePath).not.toBe(hierarchy[1]?.treePath);
		});

		it("returns empty when no parents declared", () => {
			addMockFile("Note1.md", { flashcard_uid: "uid-1" });
			addMockFile("Note2.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			expect(service.buildHierarchy()).toHaveLength(0);
		});

		it("handles unresolvable parent names gracefully", () => {
			addMockFile("Note.md", {
				parents: ["[[NonExistent]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			// Virtual parent created for unresolvable name
			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.name).toBe("NonExistent");
			expect(hierarchy[0]?.memberPaths).toContain("Note.md");
		});
	});

	describe("cycle detection", () => {
		it("breaks direct cycles (A→B→A)", () => {
			addMockFile("A.md", { parents: ["[[B]]"] });
			addMockFile("B.md", { parents: ["[[A]]"] });
			frontmatterIndex.rebuildIndex();

			// Should not infinite loop
			const hierarchy = service.buildHierarchy();
			expect(hierarchy.length).toBeGreaterThanOrEqual(0);
		});

		it("breaks transitive cycles (A→B→C→A)", () => {
			addMockFile("A.md", { parents: ["[[C]]"] });
			addMockFile("B.md", { parents: ["[[A]]"] });
			addMockFile("C.md", { parents: ["[[B]]"] });
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("getSourceUidsForProject", () => {
		it("collects UIDs from direct children", () => {
			addMockFile("Project.md", {});
			addMockFile("Note1.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-1",
			});
			addMockFile("Note2.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Project.md", false);
			expect(uids).toEqual(new Set(["uid-1", "uid-2"]));
		});

		it("includes UIDs from descendants when includeChildren=true", () => {
			addMockFile("ML.md", {});
			addMockFile("Python.md", { parents: ["[[ML]]"] });
			addMockFile("Basics.md", {
				parents: ["[[Python]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("ML.md", true);
			expect(uids).toContain("uid-1");
		});

		it("excludes descendant UIDs when includeChildren=false", () => {
			addMockFile("ML.md", {});
			addMockFile("Python.md", { parents: ["[[ML]]"] });
			addMockFile("Direct.md", {
				parents: ["[[ML]]"],
				flashcard_uid: "uid-direct",
			});
			addMockFile("Nested.md", {
				parents: ["[[Python]]"],
				flashcard_uid: "uid-nested",
			});
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("ML.md", false);
			expect(uids).toContain("uid-direct");
			expect(uids).not.toContain("uid-nested");
		});

		it("deduplicates UIDs in polyhierarchy (set-union)", () => {
			addMockFile("Root.md", {});
			addMockFile("ML.md", { parents: ["[[Root]]"] });
			addMockFile("Bio.md", { parents: ["[[Root]]"] });
			addMockFile("Shared.md", {
				parents: ["[[ML]]", "[[Bio]]"],
				flashcard_uid: "uid-shared",
			});
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Root.md", true);
			// uid-shared should appear only once despite being under both ML and Bio
			expect(uids.size).toBe(1);
			expect(uids).toContain("uid-shared");
		});

		it("includes the project node's own UIDs", () => {
			addMockFile("Project.md", { flashcard_uid: "uid-proj" });
			addMockFile("Note.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Project.md");
			expect(uids).toContain("uid-proj");
			expect(uids).toContain("uid-1");
		});

		it("returns empty for project with no members", () => {
			addMockFile("Empty.md", {});
			frontmatterIndex.rebuildIndex();

			// Empty.md has no children (no one declares it as parent)
			// and no flashcard_uid of its own
			const uids = service.getSourceUidsForProject("Empty.md");
			expect(uids.size).toBe(0);
		});
	});

	describe("getUnassignedPaths", () => {
		it("returns flashcard notes with no parents and not a project root", () => {
			addMockFile("Project.md", {});
			addMockFile("Assigned.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-1",
			});
			addMockFile("Orphan.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).toContain("Orphan.md");
			expect(unassigned).not.toContain("Assigned.md");
		});

		it("excludes project root notes from unassigned", () => {
			addMockFile("Project.md", { flashcard_uid: "uid-proj" });
			addMockFile("Note.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).not.toContain("Project.md");
			expect(unassigned).not.toContain("Note.md");
		});

		it("returns all flashcard notes when no hierarchy exists", () => {
			addMockFile("Note1.md", { flashcard_uid: "uid-1" });
			addMockFile("Note2.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).toContain("Note1.md");
			expect(unassigned).toContain("Note2.md");
		});
	});

	describe("getParentsForNote", () => {
		it("returns parent paths for a note", () => {
			addMockFile("ML.md", {});
			addMockFile("Bio.md", {});
			addMockFile("Note.md", {
				parents: ["[[ML]]", "[[Bio]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const parents = service.getParentsForNote("Note.md");
			expect(parents).toContain("ML.md");
			expect(parents).toContain("Bio.md");
		});

		it("returns empty for notes with no parents", () => {
			addMockFile("Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			expect(service.getParentsForNote("Note.md")).toHaveLength(0);
		});
	});

	describe("getChildPaths", () => {
		it("returns children of a node", () => {
			addMockFile("Project.md", {});
			addMockFile("Note1.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-1",
			});
			addMockFile("Note2.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const children = service.getChildPaths("Project.md");
			expect(children).toContain("Note1.md");
			expect(children).toContain("Note2.md");
		});

		it("returns empty for leaf nodes", () => {
			addMockFile("Leaf.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			expect(service.getChildPaths("Leaf.md")).toHaveLength(0);
		});
	});

	describe("getDescendantPaths", () => {
		it("returns empty array for leaf note", () => {
			addMockFile("Leaf.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();
			expect(service.getDescendantPaths("Leaf.md")).toEqual([]);
		});

		it("returns immediate children", () => {
			addMockFile("Project.md", {});
			addMockFile("Note1.md", { parents: ["[[Project]]"] });
			addMockFile("Note2.md", { parents: ["[[Project]]"] });
			frontmatterIndex.rebuildIndex();
			const paths = service.getDescendantPaths("Project.md");
			expect(paths).toHaveLength(2);
			expect(paths).toContain("Note1.md");
			expect(paths).toContain("Note2.md");
		});

		it("returns deeply nested descendants", () => {
			addMockFile("Root.md", {});
			addMockFile("Sub.md", { parents: ["[[Root]]"] });
			addMockFile("Leaf.md", { parents: ["[[Sub]]"] });
			frontmatterIndex.rebuildIndex();
			const paths = service.getDescendantPaths("Root.md");
			expect(paths).toHaveLength(2);
			expect(paths).toContain("Sub.md");
			expect(paths).toContain("Leaf.md");
		});

		it("handles cycles without infinite loop", () => {
			addMockFile("A.md", { parents: ["[[B]]"] });
			addMockFile("B.md", { parents: ["[[A]]"] });
			frontmatterIndex.rebuildIndex();
			const paths = service.getDescendantPaths("A.md");
			expect(paths).toContain("B.md");
		});
	});

	describe("getPathsForCascade", () => {
		it("archive: returns all descendants when no multi-parent", () => {
			addMockFile("Project.md", {});
			addMockFile("Note1.md", { parents: ["[[Project]]"] });
			addMockFile("Note2.md", { parents: ["[[Project]]"] });
			frontmatterIndex.rebuildIndex();
			const paths = service.getPathsForCascade("Project.md", true);
			expect(paths).toHaveLength(2);
			expect(paths).toContain("Note1.md");
			expect(paths).toContain("Note2.md");
		});

		it("archive: skips note with another active parent", () => {
			addMockFile("ProjectA.md", {});
			addMockFile("ProjectB.md", {});
			addMockFile("Shared.md", {
				parents: ["[[ProjectA]]", "[[ProjectB]]"],
			});
			addMockFile("OnlyA.md", { parents: ["[[ProjectA]]"] });
			frontmatterIndex.rebuildIndex();
			const paths = service.getPathsForCascade("ProjectA.md", true);
			expect(paths).toContain("OnlyA.md");
			expect(paths).not.toContain("Shared.md");
		});

		it("archive: includes shared note if other parent is also archived", () => {
			addMockFile("ProjectA.md", {});
			addMockFile("ProjectB.md", { archive: true });
			addMockFile("Shared.md", {
				parents: ["[[ProjectA]]", "[[ProjectB]]"],
			});
			frontmatterIndex.rebuildIndex();
			const paths = service.getPathsForCascade("ProjectA.md", true);
			expect(paths).toContain("Shared.md");
		});

		it("unarchive: returns all descendants unconditionally", () => {
			addMockFile("Project.md", { archive: true });
			addMockFile("ProjectB.md", { archive: true });
			addMockFile("Shared.md", {
				parents: ["[[Project]]", "[[ProjectB]]"],
				archive: true,
			});
			addMockFile("OnlyP.md", {
				parents: ["[[Project]]"],
				archive: true,
			});
			frontmatterIndex.rebuildIndex();
			const paths = service.getPathsForCascade("Project.md", false);
			expect(paths).toHaveLength(2);
			expect(paths).toContain("Shared.md");
			expect(paths).toContain("OnlyP.md");
		});

		it("archive: handles deep nesting with multi-parent at leaf", () => {
			addMockFile("Root.md", {});
			addMockFile("Sub.md", { parents: ["[[Root]]"] });
			addMockFile("ActiveParent.md", {});
			addMockFile("Leaf.md", {
				parents: ["[[Sub]]", "[[ActiveParent]]"],
			});
			frontmatterIndex.rebuildIndex();
			const paths = service.getPathsForCascade("Root.md", true);
			expect(paths).toContain("Sub.md");
			expect(paths).not.toContain("Leaf.md");
		});
	});

	describe("getArchivedSourceUids", () => {
		it("collects UIDs from notes with archive: true", () => {
			addMockFile("Archived.md", {
				archive: true,
				flashcard_uid: "uid-arch",
			});
			addMockFile("Active.md", { flashcard_uid: "uid-active" });
			frontmatterIndex.rebuildIndex();
			const uids = service.getArchivedSourceUids();
			expect(uids).toContain("uid-arch");
			expect(uids).not.toContain("uid-active");
		});

		it("collects UIDs from individually archived descendants", () => {
			addMockFile("ArchivedProject.md", { archive: true });
			addMockFile("Note1.md", {
				parents: ["[[ArchivedProject]]"],
				flashcard_uid: "uid-1",
				archive: true,
			});
			addMockFile("Note2.md", {
				parents: ["[[ArchivedProject]]"],
				flashcard_uid: "uid-2",
				archive: true,
			});
			addMockFile("ActiveNote.md", {
				parents: ["[[ArchivedProject]]"],
				flashcard_uid: "uid-3",
			});
			frontmatterIndex.rebuildIndex();
			const uids = service.getArchivedSourceUids();
			expect(uids).toContain("uid-1");
			expect(uids).toContain("uid-2");
			expect(uids).not.toContain("uid-3");
		});

		it("ignores notes without flashcard_uid", () => {
			addMockFile("NoUid.md", { archive: true });
			frontmatterIndex.rebuildIndex();
			const uids = service.getArchivedSourceUids();
			expect(uids.size).toBe(0);
		});
	});

	describe("isNoteArchived / isProjectArchived", () => {
		it("returns true for archived notes", () => {
			addMockFile("Archived.md", { archive: true });
			frontmatterIndex.rebuildIndex();

			expect(service.isNoteArchived("Archived.md")).toBe(true);
			expect(service.isProjectArchived("Archived.md")).toBe(true);
		});

		it("returns false for non-archived notes", () => {
			addMockFile("Active.md", {});
			frontmatterIndex.rebuildIndex();

			expect(service.isNoteArchived("Active.md")).toBe(false);
		});
	});

	describe("invalidateGraph", () => {
		it("forces rebuild on next access after invalidation", () => {
			addMockFile("Project.md", {});
			addMockFile("Note.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const h1 = service.buildHierarchy();
			expect(h1).toHaveLength(1);

			// Add a new note
			addMockFile("Note2.md", {
				parents: ["[[Project]]"],
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			const h2 = service.buildHierarchy();
			expect(h2[0]?.memberPaths).toHaveLength(2);
		});
	});

	describe("explicit project marker (project: true)", () => {
		it("treats a note with project: true as a root project even without children", () => {
			addMockFile("MyProject.md", {
				flashcard_uid: "uid-1",
				project: true,
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("MyProject.md");
			expect(hierarchy[0]?.name).toBe("MyProject");
			expect(hierarchy[0]?.children).toHaveLength(0);
			expect(hierarchy[0]?.memberPaths).toHaveLength(0);
		});

		it("treats project: true with parents as a sub-project", () => {
			addMockFile("Root.md", {});
			addMockFile("Sub.md", {
				parents: ["[[Root]]"],
				project: true,
			});
			addMockFile("Leaf.md", {
				parents: ["[[Root]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("Root.md");
			// Sub.md should be in children (sub-project), not memberPaths
			expect(hierarchy[0]?.children).toHaveLength(1);
			expect(hierarchy[0]?.children[0]?.path).toBe("Sub.md");
			// Leaf.md should be in memberPaths
			expect(hierarchy[0]?.memberPaths).toContain("Leaf.md");
		});

		it("excludes project: true notes from unassigned paths", () => {
			addMockFile("MyProject.md", {
				flashcard_uid: "uid-1",
				project: true,
			});
			addMockFile("Unassigned.md", {
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).not.toContain("MyProject.md");
			expect(unassigned).toContain("Unassigned.md");
		});

		it("preserves backward compatibility — implicit projects still work", () => {
			addMockFile("ML.md", {});
			addMockFile("Note.md", {
				parents: ["[[ML]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("ML.md");
			expect(hierarchy[0]?.memberPaths).toContain("Note.md");
		});

		it("includes archived project: true notes in archived UIDs", () => {
			addMockFile("ArchivedProject.md", {
				flashcard_uid: "uid-1",
				project: true,
				archive: "true",
			});
			frontmatterIndex.rebuildIndex();

			const archivedUids = service.getArchivedSourceUids();
			expect(archivedUids.has("uid-1")).toBe(true);
		});

		it("does not duplicate root when project: true note also has children", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Note.md", {
				parents: ["[[ML]]"],
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("ML.md");
			expect(hierarchy[0]?.memberPaths).toContain("Note.md");
		});

		it("isExplicitProject returns true for project: true notes", () => {
			addMockFile("Proj.md", { project: true });
			addMockFile("Regular.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			expect(service.isExplicitProject("Proj.md")).toBe(true);
			expect(service.isExplicitProject("Regular.md")).toBe(false);
		});
	});

	describe("project CRUD scenarios", () => {
		it("dissolve: removing project marker makes note unassigned again", () => {
			addMockFile("MyProject.md", {
				flashcard_uid: "uid-1",
				project: true,
			});
			frontmatterIndex.rebuildIndex();

			// Before dissolve: project exists, note is not unassigned
			expect(service.buildHierarchy()).toHaveLength(1);
			expect(service.getUnassignedPaths()).not.toContain("MyProject.md");

			// Simulate dissolve: remove project marker
			fileData.set("MyProject.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			// After dissolve: no projects, note is unassigned
			expect(service.buildHierarchy()).toHaveLength(0);
			expect(service.getUnassignedPaths()).toContain("MyProject.md");
		});

		it("dissolve: removing marker + detaching children restores all to unassigned", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Child1.md", {
				flashcard_uid: "uid-1",
				parents: ["[[Project]]"],
			});
			addMockFile("Child2.md", {
				flashcard_uid: "uid-2",
				parents: ["[[Project]]"],
			});
			frontmatterIndex.rebuildIndex();

			expect(service.buildHierarchy()).toHaveLength(1);
			expect(service.getUnassignedPaths()).toHaveLength(0);

			// Simulate dissolve: remove parents from children + unmark project
			fileData.set("Project.md", {});
			fileData.set("Child1.md", { flashcard_uid: "uid-1" });
			fileData.set("Child2.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			expect(service.buildHierarchy()).toHaveLength(0);
			expect(service.getUnassignedPaths()).toContain("Child1.md");
			expect(service.getUnassignedPaths()).toContain("Child2.md");
		});

		it("assign: adding parent to unassigned note removes it from unassigned", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			expect(service.getUnassignedPaths()).toContain("Note.md");

			// Simulate assign
			fileData.set("Note.md", {
				flashcard_uid: "uid-1",
				parents: ["[[Project]]"],
			});
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			expect(service.getUnassignedPaths()).not.toContain("Note.md");
			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.memberPaths).toContain("Note.md");
		});

		it("detach: removing parent from assigned note makes it unassigned", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Note.md", {
				flashcard_uid: "uid-1",
				parents: ["[[Project]]"],
			});
			frontmatterIndex.rebuildIndex();

			expect(service.getUnassignedPaths()).not.toContain("Note.md");

			// Simulate detach
			fileData.set("Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			expect(service.getUnassignedPaths()).toContain("Note.md");
		});

		it("reparent: moving note between projects updates hierarchy", () => {
			addMockFile("ProjectA.md", { project: true });
			addMockFile("ProjectB.md", { project: true });
			addMockFile("Note.md", {
				flashcard_uid: "uid-1",
				parents: ["[[ProjectA]]"],
			});
			frontmatterIndex.rebuildIndex();

			const h1 = service.buildHierarchy();
			const projA = h1.find((n) => n.name === "ProjectA");
			expect(projA?.memberPaths).toContain("Note.md");

			// Simulate reparent: remove old parent, add new
			fileData.set("Note.md", {
				flashcard_uid: "uid-1",
				parents: ["[[ProjectB]]"],
			});
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			const h2 = service.buildHierarchy();
			const projA2 = h2.find((n) => n.name === "ProjectA");
			const projB2 = h2.find((n) => n.name === "ProjectB");
			expect(projA2?.memberPaths).not.toContain("Note.md");
			expect(projB2?.memberPaths).toContain("Note.md");
		});

		it("convert: marking note as project removes it from unassigned and adds to hierarchy", () => {
			addMockFile("Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			expect(service.getUnassignedPaths()).toContain("Note.md");
			expect(service.buildHierarchy()).toHaveLength(0);

			// Simulate convert
			fileData.set("Note.md", { flashcard_uid: "uid-1", project: true });
			frontmatterIndex.rebuildIndex();
			service.invalidateGraph();

			expect(service.getUnassignedPaths()).not.toContain("Note.md");
			expect(service.buildHierarchy()).toHaveLength(1);
			expect(service.buildHierarchy()[0]?.path).toBe("Note.md");
		});
	});

	// NOTE: "include: folder" feature was removed during the core package reorganization.
	// These tests are commented out pending re-implementation or deletion.
	// describe("include: folder", () => { ... });
});
