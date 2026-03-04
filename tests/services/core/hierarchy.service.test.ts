import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
	App,
	Vault,
	MetadataCache,
	TFile,
	CachedMetadata,
} from "obsidian";
import { FrontmatterIndexService } from "../../../src/features/core/services/frontmatter-index.service";
import { HierarchyService } from "../../../src/features/core/services/hierarchy.service";

describe("HierarchyService", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let mockFiles: TFile[];
	let mockCacheData: Map<string, CachedMetadata>;
	let frontmatterIndex: FrontmatterIndexService;
	let service: HierarchyService;

	function createMockFile(path: string): TFile {
		const name = path.split("/").pop() ?? path;
		// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- Test mock
		return { path, name, extension: "md" } as TFile;
	}

	function addMockFile(
		path: string,
		frontmatter?: Record<string, unknown>,
	): TFile {
		const file = createMockFile(path);
		mockFiles.push(file);
		mockCacheData.set(path, { frontmatter } as CachedMetadata);
		return file;
	}

	beforeEach(() => {
		mockFiles = [];
		mockCacheData = new Map();

		mockVault = {
			getMarkdownFiles: vi.fn(() => mockFiles),
			getAbstractFileByPath: vi.fn(
				(path: string) =>
					mockFiles.find((f) => f.path === path) ?? null,
			),
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as Vault;

		mockMetadataCache = {
			getFileCache: vi.fn(
				(file: TFile) => mockCacheData.get(file.path) ?? null,
			),
			getFirstLinkpathDest: vi.fn((name: string) =>
				mockFiles.find(
					(f) => f.name === `${name}.md` || f.path === `${name}.md` || f.path === name,
				) ?? null,
			),
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as MetadataCache;

		mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
		} as unknown as App;

		frontmatterIndex = new FrontmatterIndexService(mockApp);
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

		service = new HierarchyService(mockApp, frontmatterIndex);
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

			// Should not crash, just skip the unresolvable parent
			expect(service.buildHierarchy()).toHaveLength(0);
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

	describe("getArchivedSourceUids", () => {
		it("collects UIDs from archived regular notes", () => {
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

		it("collects all descendant UIDs from archived project nodes", () => {
			addMockFile("ArchivedProject.md", { archive: true });
			addMockFile("Note1.md", {
				parents: ["[[ArchivedProject]]"],
				flashcard_uid: "uid-1",
			});
			addMockFile("Note2.md", {
				parents: ["[[ArchivedProject]]"],
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const uids = service.getArchivedSourceUids();
			expect(uids).toContain("uid-1");
			expect(uids).toContain("uid-2");
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

	describe("include: folder", () => {
		it("folder note with include: folder adds direct files as children", () => {
			addMockFile("Science/Science.md", { include: "folder" });
			addMockFile("Science/Physics.md", { flashcard_uid: "uid-phys" });
			addMockFile("Science/Chemistry.md", { flashcard_uid: "uid-chem" });
			frontmatterIndex.rebuildIndex();

			const tree = service.buildHierarchy();
			expect(tree).toHaveLength(1);
			expect(tree[0]?.name).toBe("Science");
			expect(tree[0]?.memberPaths).toContain("Science/Physics.md");
			expect(tree[0]?.memberPaths).toContain("Science/Chemistry.md");
		});

		it("does NOT include files in subfolders (non-recursive)", () => {
			addMockFile("Science/Science.md", { include: "folder" });
			addMockFile("Science/Physics.md", { flashcard_uid: "uid-phys" });
			addMockFile("Science/Quantum/Spin.md", { flashcard_uid: "uid-spin" });
			frontmatterIndex.rebuildIndex();

			const tree = service.buildHierarchy();
			expect(tree[0]?.memberPaths).toContain("Science/Physics.md");
			expect(tree[0]?.memberPaths).not.toContain("Science/Quantum/Spin.md");
		});

		it("does not include the folder note itself", () => {
			addMockFile("Science/Science.md", {
				include: "folder",
				flashcard_uid: "uid-sci",
			});
			addMockFile("Science/Physics.md", { flashcard_uid: "uid-phys" });
			frontmatterIndex.rebuildIndex();

			const tree = service.buildHierarchy();
			expect(tree[0]?.memberPaths).not.toContain("Science/Science.md");
		});

		it("merges with explicit parents", () => {
			addMockFile("Science/Science.md", { include: "folder" });
			addMockFile("Other.md", {});
			addMockFile("Science/Physics.md", {
				flashcard_uid: "uid-phys",
				parents: ["[[Other]]"],
			});
			frontmatterIndex.rebuildIndex();

			// Physics is under both Science (via include) and Other (via parents)
			const parents = service.getParentsForNote("Science/Physics.md");
			expect(parents).toContain("Science/Science.md");
			expect(parents).toContain("Other.md");
		});

		it("collects UIDs from folder-included notes", () => {
			addMockFile("Science/Science.md", { include: "folder" });
			addMockFile("Science/Physics.md", { flashcard_uid: "uid-phys" });
			addMockFile("Science/Chemistry.md", { flashcard_uid: "uid-chem" });
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Science/Science.md");
			expect(uids).toContain("uid-phys");
			expect(uids).toContain("uid-chem");
		});

		it("folder-included notes are not unassigned", () => {
			addMockFile("Science/Science.md", { include: "folder" });
			addMockFile("Science/Physics.md", { flashcard_uid: "uid-phys" });
			addMockFile("Orphan.md", { flashcard_uid: "uid-orphan" });
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).not.toContain("Science/Physics.md");
			expect(unassigned).toContain("Orphan.md");
		});

		it("handles empty folder (no other files)", () => {
			addMockFile("Empty/Empty.md", { include: "folder" });
			frontmatterIndex.rebuildIndex();

			// No children → not a project root → doesn't appear in tree
			const tree = service.buildHierarchy();
			expect(tree).toHaveLength(0);
		});
	});
});
