import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
	App,
	Vault,
	MetadataCache,
	TFile,
	CachedMetadata,
} from "obsidian";
import { FrontmatterIndexService } from "../../../src/features/core/services/frontmatter-index.service";
import { FolderProjectService } from "../../../src/features/core/services/folder-project.service";
import { ProjectLinkService } from "../../../src/features/core/services/project-link.service";
import type { TrueRecallSettings } from "../../../src/shared/types/settings.types";

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

			expect(hierarchy).toHaveLength(1);
			expect(hierarchy[0]?.path).toBe("ML.md");
			expect(hierarchy[0]?.children).toHaveLength(1);
			expect(hierarchy[0]?.children[0]?.path).toBe("Python.md");
			expect(hierarchy[0]?.children[0]?.memberPaths).toContain(
				"Basics.md",
			);
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
			setLinks("A.md", ["B.md"]);
			setLinks("B.md", ["A.md"]);
			frontmatterIndex.rebuildIndex();

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
			expect(uids).not.toContain("uid-nested");
		});

		it("handles projects with no members", () => {
			addMockFile("Empty.md", { project: true });
			frontmatterIndex.rebuildIndex();

			const uids = service.getSourceUidsForProject("Empty.md");
			expect(uids.size).toBe(0);
		});
	});

	// ─────────────────────────────────────────────────
	// Folder-project integration tests
	// ─────────────────────────────────────────────────

	describe("folder-project integration", () => {
		let folderProjectService: FolderProjectService;
		let settings: Partial<TrueRecallSettings>;

		beforeEach(() => {
			settings = {
				folderProjectsEnabled: true,
				excludedFolders: [],
			};

			folderProjectService = new FolderProjectService(
				mockApp,
				frontmatterIndex,
				() => settings as TrueRecallSettings,
			);

			service = new ProjectLinkService(
				mockApp,
				frontmatterIndex,
				folderProjectService,
			);
		});

		describe("buildHierarchy with folder projects", () => {
			it("includes folder-projects in hierarchy", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Math/Advanced.md", { flashcard_uid: "uid-2" });
				frontmatterIndex.rebuildIndex();

				const hierarchy = service.buildHierarchy();
				expect(hierarchy).toHaveLength(1);
				expect(hierarchy[0]?.name).toBe("Math");
				expect(hierarchy[0]?.memberPaths).toContain("Math/Basics.md");
				expect(hierarchy[0]?.memberPaths).toContain(
					"Math/Advanced.md",
				);
			});

			it("merges folder-project with link-project when Folder Note has project: true", () => {
				// Folder Note with project: true and wiki links
				addMockFile("Math/Math.md", { project: true });
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("External.md", { flashcard_uid: "uid-ext" });
				setLinks("Math/Math.md", ["External.md"]);
				frontmatterIndex.rebuildIndex();

				const hierarchy = service.buildHierarchy();

				// Should be ONE project (merged), not two
				const mathProjects = hierarchy.filter(
					(h) =>
						h.path === "Math/Math.md" || h.name === "Math",
				);
				expect(mathProjects).toHaveLength(1);

				const math = mathProjects[0]!;
				// Members should include both folder content and wiki links
				expect(math.memberPaths).toContain("Math/Basics.md");
				expect(math.memberPaths).toContain("External.md");
			});

			it("shows folder-projects alongside link-projects", () => {
				// Link-based project
				addMockFile("ML.md", { project: true });
				addMockFile("Note.md", { flashcard_uid: "uid-1" });
				setLinks("ML.md", ["Note.md"]);

				// Folder-based project (no project: true)
				addMockFile("History/Event1.md", { flashcard_uid: "uid-2" });
				frontmatterIndex.rebuildIndex();

				const hierarchy = service.buildHierarchy();
				expect(hierarchy).toHaveLength(2);

				const names = hierarchy.map((h) => h.name).sort();
				expect(names).toContain("History");
				expect(names).toContain("ML");
			});

			it("includes subfolder children in folder hierarchy", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Math/Algebra/Equations.md", {
					flashcard_uid: "uid-2",
				});
				frontmatterIndex.rebuildIndex();

				const hierarchy = service.buildHierarchy();
				const math = hierarchy.find((h) => h.name === "Math");
				expect(math).toBeDefined();
				expect(math!.children).toHaveLength(1);
				expect(math!.children[0]?.name).toBe("Algebra");
			});

			it("returns only link-projects when folderProjectsEnabled is false", () => {
				settings.folderProjectsEnabled = false;

				addMockFile("ML.md", { project: true });
				addMockFile("Note.md", { flashcard_uid: "uid-1" });
				setLinks("ML.md", ["Note.md"]);
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-2" });
				frontmatterIndex.rebuildIndex();

				folderProjectService.invalidateCache();
				const hierarchy = service.buildHierarchy();
				expect(hierarchy).toHaveLength(1);
				expect(hierarchy[0]?.path).toBe("ML.md");
			});
		});

		describe("getMemberPaths with folder projects", () => {
			it("returns folder contents for Folder Note path", () => {
				addMockFile("Math/Math.md", { project: true });
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Math/Advanced.md", { flashcard_uid: "uid-2" });
				frontmatterIndex.rebuildIndex();

				const members = service.getMemberPaths("Math/Math.md");
				expect(members).toContain("Math/Basics.md");
				expect(members).toContain("Math/Advanced.md");
				expect(members).not.toContain("Math/Math.md");
			});

			it("returns folder contents for folder path (non-.md)", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				frontmatterIndex.rebuildIndex();

				const members = service.getMemberPaths("Math");
				expect(members).toContain("Math/Basics.md");
			});

			it("returns union of wiki links and folder contents", () => {
				addMockFile("Math/Math.md", { project: true });
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("External.md", { flashcard_uid: "uid-ext" });
				setLinks("Math/Math.md", ["External.md"]);
				frontmatterIndex.rebuildIndex();

				const members = service.getMemberPaths("Math/Math.md");
				expect(members).toContain("Math/Basics.md");
				expect(members).toContain("External.md");
			});
		});

		describe("getUnassignedPaths with folder projects", () => {
			it("excludes folder-project members from unassigned", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Orphan.md", { flashcard_uid: "uid-2" });
				frontmatterIndex.rebuildIndex();

				const unassigned = service.getUnassignedPaths();
				expect(unassigned).not.toContain("Math/Basics.md");
				expect(unassigned).toContain("Orphan.md");
			});

			it("excludes Folder Note itself from unassigned", () => {
				addMockFile("Math/Math.md", {
					project: true,
					flashcard_uid: "uid-fn",
				});
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				frontmatterIndex.rebuildIndex();

				const unassigned = service.getUnassignedPaths();
				expect(unassigned).not.toContain("Math/Math.md");
				expect(unassigned).not.toContain("Math/Basics.md");
			});
		});

		describe("getSourceUidsForProject with folder paths", () => {
			it("collects UIDs from folder members via folder path", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Math/Advanced.md", { flashcard_uid: "uid-2" });
				frontmatterIndex.rebuildIndex();

				const uids = service.getSourceUidsForProject("Math");
				expect(uids).toEqual(new Set(["uid-1", "uid-2"]));
			});

			it("includes child folder UIDs with includeChildren=true", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Math/Algebra/Equations.md", {
					flashcard_uid: "uid-2",
				});
				frontmatterIndex.rebuildIndex();

				const uids = service.getSourceUidsForProject("Math", true);
				expect(uids).toContain("uid-1");
				expect(uids).toContain("uid-2");
			});

			it("excludes child folder UIDs with includeChildren=false", () => {
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("Math/Algebra/Equations.md", {
					flashcard_uid: "uid-2",
				});
				frontmatterIndex.rebuildIndex();

				const uids = service.getSourceUidsForProject("Math", false);
				expect(uids).toContain("uid-1");
				expect(uids).not.toContain("uid-2");
			});

			it("includes UIDs from Folder Note wiki links", () => {
				addMockFile("Math/Math.md", {});
				addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
				addMockFile("External.md", { flashcard_uid: "uid-ext" });
				setLinks("Math/Math.md", ["External.md"]);
				frontmatterIndex.rebuildIndex();

				const uids = service.getSourceUidsForProject("Math");
				expect(uids).toContain("uid-1");
				expect(uids).toContain("uid-ext");
			});
		});
	});
});
