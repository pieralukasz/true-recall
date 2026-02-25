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
import type { TrueRecallSettings } from "../../../src/shared/types/settings.types";

describe("FolderProjectService", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let mockFiles: TFile[];
	let mockCacheData: Map<string, CachedMetadata>;
	let frontmatterIndex: FrontmatterIndexService;
	let service: FolderProjectService;
	let settings: Partial<TrueRecallSettings>;

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
		settings = {
			folderProjectsEnabled: true,
			excludedFolders: [],
		};

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
			resolvedLinks: {},
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as MetadataCache;

		mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
		} as unknown as App;

		frontmatterIndex = new FrontmatterIndexService(mockApp);
		frontmatterIndex.register({
			field: "flashcard_uid",
			type: "string",
			unique: true,
		});
		frontmatterIndex.register({
			field: "project",
			type: "string",
			unique: false,
		});

		service = new FolderProjectService(
			mockApp,
			frontmatterIndex,
			() => settings as TrueRecallSettings,
		);
	});

	describe("discoverFolderProjects", () => {
		it("discovers folders with flashcard notes", () => {
			addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
			addMockFile("Math/Advanced.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(1);
			expect(projects[0]?.folderPath).toBe("Math");
			expect(projects[0]?.memberPaths).toContain("Math/Basics.md");
			expect(projects[0]?.memberPaths).toContain("Math/Advanced.md");
		});

		it("discovers multiple folders as separate projects", () => {
			addMockFile("Math/Note1.md", { flashcard_uid: "uid-1" });
			addMockFile("Science/Note2.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(2);
			const paths = projects.map((p) => p.folderPath).sort();
			expect(paths).toEqual(["Math", "Science"]);
		});

		it("excludes root vault folder", () => {
			addMockFile("RootNote.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(0);
		});

		it("skips folders with no flashcard notes", () => {
			addMockFile("Math/Note.md", {}); // no flashcard_uid
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(0);
		});

		it("returns empty when folderProjectsEnabled is false", () => {
			settings.folderProjectsEnabled = false;
			addMockFile("Math/Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(0);
		});

		it("excludes folders matching excludedFolders", () => {
			settings.excludedFolders = ["templates"];
			addMockFile("templates/Note.md", { flashcard_uid: "uid-1" });
			addMockFile("Math/Note.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(1);
			expect(projects[0]?.folderPath).toBe("Math");
		});

		it("excludes subfolders of excludedFolders (prefix match)", () => {
			settings.excludedFolders = ["archive"];
			addMockFile("archive/old/Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(0);
		});

		it("excludes folder when Folder Note has project: false", () => {
			addMockFile("Math/Math.md", { project: false });
			addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(0);
		});

		it("keeps folder when Folder Note has project: true", () => {
			addMockFile("Math/Math.md", { project: true });
			addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects).toHaveLength(1);
			expect(projects[0]?.folderNotePath).toBe("Math/Math.md");
		});

		it("excludes Folder Note itself from memberPaths", () => {
			addMockFile("Math/Math.md", {
				project: true,
				flashcard_uid: "uid-fn",
			});
			addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			expect(projects[0]?.memberPaths).not.toContain("Math/Math.md");
			expect(projects[0]?.memberPaths).toContain("Math/Basics.md");
		});
	});

	describe("recursive subfolder discovery", () => {
		it("discovers subfolders as child projects", () => {
			addMockFile("Math/Basics.md", { flashcard_uid: "uid-1" });
			addMockFile("Math/Algebra/Equations.md", {
				flashcard_uid: "uid-2",
			});
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();
			const mathProject = projects.find(
				(p) => p.folderPath === "Math",
			);
			expect(mathProject).toBeDefined();
			expect(mathProject?.childFolderPaths).toContain("Math/Algebra");
		});

		it("handles deep nesting with correct parent-child relationships", () => {
			addMockFile("A/Note.md", { flashcard_uid: "uid-1" });
			addMockFile("A/B/Note.md", { flashcard_uid: "uid-2" });
			addMockFile("A/B/C/Note.md", { flashcard_uid: "uid-3" });
			frontmatterIndex.rebuildIndex();

			const projects = service.discoverFolderProjects();

			const a = projects.find((p) => p.folderPath === "A");
			const ab = projects.find((p) => p.folderPath === "A/B");
			const abc = projects.find((p) => p.folderPath === "A/B/C");

			// A's direct child is A/B (not A/B/C — that's A/B's child)
			expect(a?.childFolderPaths).toContain("A/B");
			expect(a?.childFolderPaths).not.toContain("A/B/C");

			expect(ab?.childFolderPaths).toContain("A/B/C");
			expect(abc?.childFolderPaths).toHaveLength(0);
		});
	});

	describe("getFolderNotePath", () => {
		it("detects Folder Note matching folder name", () => {
			addMockFile("Math/Math.md", {});
			frontmatterIndex.rebuildIndex();

			expect(service.getFolderNotePath("Math")).toBe("Math/Math.md");
		});

		it("returns null when no Folder Note exists", () => {
			addMockFile("Math/Basics.md", {});
			frontmatterIndex.rebuildIndex();

			expect(service.getFolderNotePath("Math")).toBeNull();
		});

		it("handles nested folder paths", () => {
			addMockFile("CS/Algorithms/Algorithms.md", {});
			frontmatterIndex.rebuildIndex();

			expect(service.getFolderNotePath("CS/Algorithms")).toBe(
				"CS/Algorithms/Algorithms.md",
			);
		});
	});

	describe("getFolderPathForNote", () => {
		it("returns folder path when note is a Folder Note", () => {
			expect(service.getFolderPathForNote("Math/Math.md")).toBe("Math");
		});

		it("returns null for regular notes", () => {
			expect(service.getFolderPathForNote("Math/Basics.md")).toBeNull();
		});

		it("returns null for root-level notes", () => {
			expect(service.getFolderPathForNote("Note.md")).toBeNull();
		});

		it("handles nested Folder Notes", () => {
			expect(
				service.getFolderPathForNote("CS/Algorithms/Algorithms.md"),
			).toBe("CS/Algorithms");
		});
	});

	describe("isExcluded", () => {
		it("returns true when folderProjectsEnabled is false", () => {
			settings.folderProjectsEnabled = false;
			expect(service.isExcluded("Math")).toBe(true);
		});

		it("returns true for exact match in excludedFolders", () => {
			settings.excludedFolders = ["templates"];
			expect(service.isExcluded("templates")).toBe(true);
		});

		it("returns true for subfolder of excludedFolders", () => {
			settings.excludedFolders = ["archive"];
			expect(service.isExcluded("archive/old")).toBe(true);
		});

		it("returns false for non-excluded folder", () => {
			settings.excludedFolders = ["templates"];
			expect(service.isExcluded("Math")).toBe(false);
		});

		it("does not match partial folder names", () => {
			settings.excludedFolders = ["temp"];
			expect(service.isExcluded("templates")).toBe(false);
		});
	});

	describe("caching", () => {
		it("returns cached results on subsequent calls", () => {
			addMockFile("Math/Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const first = service.discoverFolderProjects();
			const second = service.discoverFolderProjects();
			expect(first).toBe(second); // same reference = cached
		});

		it("invalidates cache and rediscovers", () => {
			addMockFile("Math/Note.md", { flashcard_uid: "uid-1" });
			frontmatterIndex.rebuildIndex();

			const first = service.discoverFolderProjects();
			expect(first).toHaveLength(1);

			service.invalidateCache();

			addMockFile("Science/Note.md", { flashcard_uid: "uid-2" });
			frontmatterIndex.rebuildIndex();

			const second = service.discoverFolderProjects();
			expect(second).toHaveLength(2);
			expect(first).not.toBe(second); // different reference
		});
	});
});
