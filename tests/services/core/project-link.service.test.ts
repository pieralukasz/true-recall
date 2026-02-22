import { describe, it, expect, vi, beforeEach } from "vitest";
import type { App, Vault, MetadataCache, TFile, CachedMetadata } from "obsidian";
import { FrontmatterIndexService } from "../../../src/features/core/services/frontmatter-index.service";
import { ProjectLinkService } from "../../../src/features/core/services/project-link.service";

describe("ProjectLinkService", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let mockFiles: TFile[];
	let mockCacheData: Map<string, CachedMetadata>;
	let resolvedLinks: Record<string, Record<string, number>>;
	let frontmatterIndex: FrontmatterIndexService;
	let service: ProjectLinkService;

	function createMockFile(path: string): TFile {
		// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- Test mock
		return { path, name: path, extension: "md" } as TFile;
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

	function setLinks(from: string, to: string[]) {
		resolvedLinks[from] = {};
		for (const t of to) {
			resolvedLinks[from][t] = 1;
		}
	}

	beforeEach(() => {
		mockFiles = [];
		mockCacheData = new Map();
		resolvedLinks = {};

		mockVault = {
			getMarkdownFiles: vi.fn(() => mockFiles),
			getAbstractFileByPath: vi.fn(
				(path: string) => mockFiles.find((f) => f.path === path) ?? null,
			),
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as Vault;

		mockMetadataCache = {
			getFileCache: vi.fn(
				(file: TFile) => mockCacheData.get(file.path) ?? null,
			),
			resolvedLinks,
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as MetadataCache;

		mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
		} as unknown as App;

		frontmatterIndex = new FrontmatterIndexService(mockApp);
		frontmatterIndex.register({
			field: "project",
			type: "string",
			unique: false,
		});
		frontmatterIndex.register({
			field: "flashcard_uid",
			type: "string",
			unique: true,
		});

		service = new ProjectLinkService(mockApp, frontmatterIndex);
	});

	describe("getAllProjectPaths", () => {
		it("returns paths of notes with project: true", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Python.md", { project: true });
			addMockFile("Basics.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const paths = service.getAllProjectPaths();
			expect(paths).toContain("ML.md");
			expect(paths).toContain("Python.md");
			expect(paths).not.toContain("Basics.md");
		});

		it("returns empty when no projects exist", () => {
			addMockFile("note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			expect(service.getAllProjectPaths()).toHaveLength(0);
		});
	});

	describe("getMemberPaths", () => {
		it("returns outgoing wiki links from a project note", () => {
			addMockFile("Python.md", { project: true });
			addMockFile("Basics.md", { flashcard_uid: "uid-1" });
			addMockFile("Advanced.md", { flashcard_uid: "uid-2" });
			setLinks("Python.md", ["Basics.md", "Advanced.md"]);
			frontmatterIndex.rebuildIndex();

			const members = service.getMemberPaths("Python.md");
			expect(members).toContain("Basics.md");
			expect(members).toContain("Advanced.md");
		});

		it("returns empty for notes with no outgoing links", () => {
			addMockFile("Empty.md", { project: true });
			frontmatterIndex.rebuildIndex();

			expect(service.getMemberPaths("Empty.md")).toHaveLength(0);
		});

		it("only includes .md files", () => {
			addMockFile("Project.md", { project: true });
			resolvedLinks["Project.md"] = {
				"note.md": 1,
				"image.png": 1,
			};
			frontmatterIndex.rebuildIndex();

			const members = service.getMemberPaths("Project.md");
			expect(members).toEqual(["note.md"]);
		});
	});

	describe("getChildProjects", () => {
		it("returns linked notes that are also projects", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Python.md", { project: true });
			addMockFile("Basics.md", { flashcard_uid: "uid-1" });
			setLinks("ML.md", ["Python.md", "Basics.md"]);
			frontmatterIndex.rebuildIndex();

			const children = service.getChildProjects("ML.md");
			expect(children).toEqual(["Python.md"]);
		});

		it("returns empty when no linked notes are projects", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Note.md", { flashcard_uid: "uid-1" });
			setLinks("Project.md", ["Note.md"]);
			frontmatterIndex.rebuildIndex();

			expect(service.getChildProjects("Project.md")).toHaveLength(0);
		});
	});

	describe("getProjectsForNote", () => {
		it("returns projects that link to a given note", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Python.md", { project: true });
			addMockFile("Basics.md", { flashcard_uid: "uid-1" });
			setLinks("ML.md", ["Basics.md"]);
			setLinks("Python.md", ["Basics.md"]);
			frontmatterIndex.rebuildIndex();

			const projects = service.getProjectsForNote("Basics.md");
			expect(projects).toContain("ML.md");
			expect(projects).toContain("Python.md");
		});

		it("returns empty for notes not linked from any project", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Orphan.md", { flashcard_uid: "uid-1" });
			setLinks("Project.md", []);
			frontmatterIndex.rebuildIndex();

			expect(service.getProjectsForNote("Orphan.md")).toHaveLength(0);
		});
	});

	describe("getUnassignedPaths", () => {
		it("returns flashcard notes not linked from any project", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Assigned.md", { flashcard_uid: "uid-1" });
			addMockFile("Orphan.md", { flashcard_uid: "uid-2" });
			setLinks("Project.md", ["Assigned.md"]);
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).toContain("Orphan.md");
			expect(unassigned).not.toContain("Assigned.md");
			expect(unassigned).not.toContain("Project.md");
		});

		it("excludes project notes themselves", () => {
			addMockFile("Project.md", {
				project: true,
				flashcard_uid: "uid-proj",
			});
			addMockFile("Note.md", { flashcard_uid: "uid-1" });
			setLinks("Project.md", ["Note.md"]);
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).not.toContain("Project.md");
			expect(unassigned).not.toContain("Note.md");
		});

		it("returns all flashcard notes when no projects exist", () => {
			addMockFile("Note1.md", { flashcard_uid: "uid-1" });
			addMockFile("Note2.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const unassigned = service.getUnassignedPaths();
			expect(unassigned).toContain("Note1.md");
			expect(unassigned).toContain("Note2.md");
		});
	});

	describe("buildHierarchy", () => {
		it("builds a tree with root projects and children", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Python.md", { project: true });
			addMockFile("Basics.md", { flashcard_uid: "uid-1" });
			addMockFile("Advanced.md", { flashcard_uid: "uid-2" });
			setLinks("ML.md", ["Python.md"]);
			setLinks("Python.md", ["Basics.md", "Advanced.md"]);
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();

			// ML is root (no project links to it), Python is child of ML
			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("ML.md");
			expect(hierarchy[0]?.children).toHaveLength(1);
			expect(hierarchy[0]?.children[0]?.path).toBe("Python.md");
			expect(hierarchy[0]?.children[0]?.memberPaths).toContain("Basics.md");
			expect(hierarchy[0]?.children[0]?.memberPaths).toContain(
				"Advanced.md",
			);
		});

		it("handles multiple root projects", () => {
			addMockFile("A.md", { project: true });
			addMockFile("B.md", { project: true });
			addMockFile("Note.md", { flashcard_uid: "uid-1" });
			setLinks("A.md", ["Note.md"]);
			setLinks("B.md", ["Note.md"]);
			frontmatterIndex.rebuildIndex();

			const hierarchy = service.buildHierarchy();
			expect(hierarchy).toHaveLength(2);
		});

		it("prevents cycles in hierarchy", () => {
			addMockFile("A.md", { project: true });
			addMockFile("B.md", { project: true });
			// Circular: A→B, B→A
			setLinks("A.md", ["B.md"]);
			setLinks("B.md", ["A.md"]);
			frontmatterIndex.rebuildIndex();

			// Should not infinite loop
			const hierarchy = service.buildHierarchy();
			expect(hierarchy.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("getSourceUidsForProject", () => {
		it("collects UIDs from direct member notes", () => {
			addMockFile("Project.md", { project: true });
			addMockFile("Note1.md", { flashcard_uid: "uid-1" });
			addMockFile("Note2.md", { flashcard_uid: "uid-2" });
			setLinks("Project.md", ["Note1.md", "Note2.md"]);
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Project.md", false);
			expect(uids).toEqual(new Set(["uid-1", "uid-2"]));
		});

		it("includes UIDs from child projects when includeChildren=true", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Python.md", { project: true });
			addMockFile("Basics.md", { flashcard_uid: "uid-1" });
			addMockFile("Advanced.md", { flashcard_uid: "uid-2" });
			setLinks("ML.md", ["Python.md"]);
			setLinks("Python.md", ["Basics.md", "Advanced.md"]);
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("ML.md", true);
			expect(uids).toContain("uid-1");
			expect(uids).toContain("uid-2");
		});

		it("excludes child project UIDs when includeChildren=false", () => {
			addMockFile("ML.md", { project: true });
			addMockFile("Python.md", { project: true });
			addMockFile("Direct.md", { flashcard_uid: "uid-direct" });
			addMockFile("Nested.md", { flashcard_uid: "uid-nested" });
			setLinks("ML.md", ["Python.md", "Direct.md"]);
			setLinks("Python.md", ["Nested.md"]);
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("ML.md", false);
			expect(uids).toContain("uid-direct");
			// Python.md is a project link, but we walk its members even without children
			// Actually — getMemberPaths returns ALL outgoing links including Python.md
			// and Python.md might have a flashcard_uid... let's check
			// No, Python.md has project: true but no flashcard_uid, so no uid collected for it
			expect(uids).not.toContain("uid-nested");
		});

		it("handles projects with no members", () => {
			addMockFile("Empty.md", { project: true });
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Empty.md");
			expect(uids.size).toBe(0);
		});
	});
});
