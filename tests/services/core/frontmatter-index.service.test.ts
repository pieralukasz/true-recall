import { describe, it, expect, vi, beforeEach } from "vitest";
import type { App, Vault, MetadataCache, TFile, CachedMetadata } from "obsidian";
import { FrontmatterIndexService } from "../../../src/services/core/frontmatter-index.service";

describe("FrontmatterIndexService", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let mockFiles: TFile[];
	let mockCacheData: Map<string, CachedMetadata>;
	let onChangedHandler: ((file: TFile, data: string, cache: CachedMetadata) => void) | null;
	let onDeleteHandler: ((file: TFile) => void) | null;
	let onRenameHandler: ((file: TFile, oldPath: string) => void) | null;
	let service: FrontmatterIndexService;

	function createMockFile(path: string): TFile {
		return { path, extension: "md" } as TFile;
	}

	function createMockCache(frontmatter?: Record<string, unknown>): CachedMetadata {
		return { frontmatter } as CachedMetadata;
	}

	function addMockFile(path: string, frontmatter?: Record<string, unknown>): TFile {
		const file = createMockFile(path);
		mockFiles.push(file);
		mockCacheData.set(path, createMockCache(frontmatter));
		return file;
	}

	beforeEach(() => {
		onChangedHandler = null;
		onDeleteHandler = null;
		onRenameHandler = null;
		mockFiles = [];
		mockCacheData = new Map();

		mockVault = {
			getMarkdownFiles: vi.fn(() => mockFiles),
			getAbstractFileByPath: vi.fn((path: string) => mockFiles.find((f) => f.path === path) ?? null),
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "delete") onDeleteHandler = handler as typeof onDeleteHandler;
				if (event === "rename") onRenameHandler = handler as typeof onRenameHandler;
				return { unload: vi.fn() };
			}),
		} as unknown as Vault;

		mockMetadataCache = {
			getFileCache: vi.fn((file: TFile) => mockCacheData.get(file.path) ?? null),
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "changed") onChangedHandler = handler as typeof onChangedHandler;
				return { unload: vi.fn() };
			}),
		} as unknown as MetadataCache;

		mockApp = { vault: mockVault, metadataCache: mockMetadataCache } as unknown as App;
	});

	describe("unique string field (like flashcard_uid)", () => {
		beforeEach(() => {
			service = new FrontmatterIndexService(mockApp);
			service.register({ field: "flashcard_uid", type: "string", unique: true });
		});

		it("indexes unique string field and provides O(1) lookup", () => {
			addMockFile("note1.md", { flashcard_uid: "uid-1" });
			addMockFile("note2.md", { flashcard_uid: "uid-2" });
			addMockFile("note3.md", {}); // no uid

			service.rebuildIndex();
			service.registerEventsDirect();

			expect(service.getFileByValue("flashcard_uid", "uid-1")?.path).toBe("note1.md");
			expect(service.getFileByValue("flashcard_uid", "uid-2")?.path).toBe("note2.md");
			expect(service.getFileByValue("flashcard_uid", "uid-3")).toBeNull();
		});

		it("updates index when file metadata changes", () => {
			const file = addMockFile("note.md", { flashcard_uid: "old-uid" });
			service.rebuildIndex();
			service.registerEventsDirect();

			expect(service.getFileByValue("flashcard_uid", "old-uid")?.path).toBe("note.md");

			// Simulate UID change
			mockCacheData.set("note.md", createMockCache({ flashcard_uid: "new-uid" }));
			onChangedHandler?.(file, "", mockCacheData.get("note.md")!);

			expect(service.getFileByValue("flashcard_uid", "old-uid")).toBeNull();
			expect(service.getFileByValue("flashcard_uid", "new-uid")?.path).toBe("note.md");
		});

		it("removes from index when file deleted", () => {
			const file = addMockFile("note.md", { flashcard_uid: "uid-1" });
			service.rebuildIndex();
			service.registerEventsDirect();

			mockFiles = [];
			onDeleteHandler?.(file);

			expect(service.getFileByValue("flashcard_uid", "uid-1")).toBeNull();
		});

		it("updates path when file renamed", () => {
			const file = addMockFile("old.md", { flashcard_uid: "uid-1" });
			service.rebuildIndex();
			service.registerEventsDirect();

			// Simulate rename
			mockFiles = [createMockFile("new.md")];
			mockCacheData.set("new.md", mockCacheData.get("old.md")!);
			const newFile = mockFiles[0]!;
			onRenameHandler?.(newFile, "old.md");

			expect(service.getFileByValue("flashcard_uid", "uid-1")?.path).toBe("new.md");
		});
	});

	describe("non-unique array field (like projects)", () => {
		beforeEach(() => {
			service = new FrontmatterIndexService(mockApp);
			service.register({ field: "projects", type: "array", unique: false });
		});

		it("indexes array field with multiple values per file", () => {
			addMockFile("note1.md", { projects: ["Project A", "Project B"] });
			addMockFile("note2.md", { projects: ["Project A"] });
			addMockFile("note3.md", { projects: ["Project C"] });

			service.rebuildIndex();

			const filesA = service.getFilesByValue("projects", "Project A");
			expect(filesA.map((f) => f.path).sort()).toEqual(["note1.md", "note2.md"]);

			const filesB = service.getFilesByValue("projects", "Project B");
			expect(filesB.map((f) => f.path)).toEqual(["note1.md"]);

			expect(service.getFilesByValue("projects", "Project D")).toEqual([]);
		});

		it("returns all unique values", () => {
			addMockFile("note1.md", { projects: ["A", "B"] });
			addMockFile("note2.md", { projects: ["B", "C"] });

			service.rebuildIndex();

			const allProjects = service.getAllValues("projects");
			expect(allProjects).toEqual(new Set(["A", "B", "C"]));
		});

		it("returns values for a specific file path", () => {
			addMockFile("note.md", { projects: ["X", "Y", "Z"] });
			service.rebuildIndex();

			const values = service.getValues("projects", "note.md");
			expect(new Set(values)).toEqual(new Set(["X", "Y", "Z"]));
		});
	});

	describe("nested path field", () => {
		beforeEach(() => {
			service = new FrontmatterIndexService(mockApp);
			service.register({ field: "metadata.category", type: "string", unique: false });
		});

		it("extracts nested frontmatter values", () => {
			addMockFile("note1.md", { metadata: { category: "science" } });
			addMockFile("note2.md", { metadata: { category: "science" } });
			addMockFile("note3.md", { metadata: { category: "history" } });

			service.rebuildIndex();

			const scienceFiles = service.getFilesByValue("metadata.category", "science");
			expect(scienceFiles.map((f) => f.path).sort()).toEqual(["note1.md", "note2.md"]);
		});

		it("handles missing nested path gracefully", () => {
			addMockFile("note1.md", { metadata: {} }); // no category
			addMockFile("note2.md", {}); // no metadata

			service.rebuildIndex();

			expect(service.getAllValues("metadata.category").size).toBe(0);
		});
	});
});
