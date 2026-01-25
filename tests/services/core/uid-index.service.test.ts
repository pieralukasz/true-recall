/**
 * Tests for UidIndexService
 * Maintains a Map<uid, path> for O(1) lookups of files by flashcard_uid
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UidIndexService } from "../../../src/services/core/uid-index.service";
import type { App, TFile, MetadataCache, Vault, CachedMetadata } from "obsidian";

// Helper to create mock TFile
function createMockFile(path: string, basename?: string): TFile {
	return {
		path,
		basename: basename ?? path.replace(/\.md$/, "").split("/").pop()!,
		extension: "md",
	} as TFile;
}

// Helper to create mock cache with frontmatter
function createMockCache(flashcardUid?: string): CachedMetadata {
	return {
		frontmatter: flashcardUid ? { flashcard_uid: flashcardUid } : undefined,
	} as CachedMetadata;
}

describe("UidIndexService", () => {
	let service: UidIndexService;
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;

	// Event handlers captured during registration
	let onChangedHandler: ((file: TFile, data: string, cache: CachedMetadata) => void) | null;
	let onDeleteHandler: ((file: TFile) => void) | null;
	let onRenameHandler: ((file: TFile, oldPath: string) => void) | null;

	// Mock files in vault
	let mockFiles: TFile[];
	// Mock cache data per file path
	let mockCacheData: Map<string, CachedMetadata>;

	beforeEach(() => {
		// Reset handlers
		onChangedHandler = null;
		onDeleteHandler = null;
		onRenameHandler = null;

		// Reset mock data
		mockFiles = [];
		mockCacheData = new Map();

		// Create mock vault
		mockVault = {
			getMarkdownFiles: vi.fn(() => mockFiles),
			getAbstractFileByPath: vi.fn((path: string) => {
				return mockFiles.find((f) => f.path === path) ?? null;
			}),
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "delete") {
					onDeleteHandler = handler as typeof onDeleteHandler;
				} else if (event === "rename") {
					onRenameHandler = handler as typeof onRenameHandler;
				}
				return { unload: vi.fn() };
			}),
		} as unknown as Vault;

		// Create mock metadata cache
		mockMetadataCache = {
			getFileCache: vi.fn((file: TFile) => mockCacheData.get(file.path) ?? null),
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (event === "changed") {
					onChangedHandler = handler as typeof onChangedHandler;
				}
				return { unload: vi.fn() };
			}),
		} as unknown as MetadataCache;

		// Create mock app
		mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
		} as unknown as App;
	});

	// Helper to add a file to mock vault
	function addMockFile(path: string, flashcardUid?: string): TFile {
		const file = createMockFile(path);
		mockFiles.push(file);
		mockCacheData.set(path, createMockCache(flashcardUid));
		return file;
	}

	// Helper to update mock cache for a file
	function updateMockCache(path: string, flashcardUid?: string): void {
		mockCacheData.set(path, createMockCache(flashcardUid));
	}

	// Helper to create service with index built and event handlers registered
	function createService(): UidIndexService {
		const svc = new UidIndexService(mockApp);
		svc.rebuildIndex(); // Simulate onLayoutReady
		svc.registerEventsDirect();
		return svc;
	}

	describe("build index on initialization", () => {
		it("builds index with all files that have flashcard_uid", () => {
			// Setup: 3 files, 2 with UIDs
			addMockFile("note1.md", "uid-1");
			addMockFile("note2.md", "uid-2");
			addMockFile("note3.md"); // no UID

			// Act
			service = createService();

			// Assert
			expect(service.getFileByUid("uid-1")?.path).toBe("note1.md");
			expect(service.getFileByUid("uid-2")?.path).toBe("note2.md");
			expect(service.getFileByUid("uid-3")).toBeNull();
		});

		it("handles empty vault", () => {
			// Setup: no files
			service = createService();

			// Assert
			expect(service.getFileByUid("any-uid")).toBeNull();
		});

		it("handles files in subdirectories", () => {
			// Setup
			addMockFile("folder/subfolder/note.md", "deep-uid");

			// Act
			service = createService();

			// Assert
			expect(service.getFileByUid("deep-uid")?.path).toBe("folder/subfolder/note.md");
		});
	});

	describe("new file with UID (metadataCache changed event)", () => {
		it("adds new file to index when created with UID", () => {
			// Setup: start with empty vault
			service = createService();
			expect(service.getFileByUid("new-uid")).toBeNull();

			// Act: simulate new file creation
			const newFile = addMockFile("new-note.md", "new-uid");
			onChangedHandler?.(newFile, "", mockCacheData.get("new-note.md")!);

			// Assert
			expect(service.getFileByUid("new-uid")?.path).toBe("new-note.md");
		});
	});

	describe("edit file - add UID", () => {
		it("adds file to index when UID is added to frontmatter", () => {
			// Setup: file exists without UID
			const file = addMockFile("existing.md");
			service = createService();
			expect(service.getFileByUid("added-uid")).toBeNull();

			// Act: simulate adding UID to frontmatter
			updateMockCache("existing.md", "added-uid");
			onChangedHandler?.(file, "", mockCacheData.get("existing.md")!);

			// Assert
			expect(service.getFileByUid("added-uid")?.path).toBe("existing.md");
		});
	});

	describe("edit file - change UID", () => {
		it("updates index when UID is changed", () => {
			// Setup: file with old UID
			const file = addMockFile("note.md", "old-uid");
			service = createService();
			expect(service.getFileByUid("old-uid")?.path).toBe("note.md");

			// Act: simulate changing UID
			updateMockCache("note.md", "new-uid");
			onChangedHandler?.(file, "", mockCacheData.get("note.md")!);

			// Assert
			expect(service.getFileByUid("old-uid")).toBeNull();
			expect(service.getFileByUid("new-uid")?.path).toBe("note.md");
		});
	});

	describe("edit file - remove UID", () => {
		it("removes file from index when UID is removed from frontmatter", () => {
			// Setup: file with UID
			const file = addMockFile("note.md", "existing-uid");
			service = createService();
			expect(service.getFileByUid("existing-uid")?.path).toBe("note.md");

			// Act: simulate removing UID from frontmatter
			updateMockCache("note.md", undefined);
			onChangedHandler?.(file, "", mockCacheData.get("note.md")!);

			// Assert
			expect(service.getFileByUid("existing-uid")).toBeNull();
		});
	});

	describe("delete file", () => {
		it("removes file from index when file is deleted", () => {
			// Setup: file with UID
			const file = addMockFile("to-delete.md", "delete-uid");
			service = createService();
			expect(service.getFileByUid("delete-uid")?.path).toBe("to-delete.md");

			// Act: simulate file deletion
			mockFiles = mockFiles.filter((f) => f.path !== "to-delete.md");
			onDeleteHandler?.(file);

			// Assert
			expect(service.getFileByUid("delete-uid")).toBeNull();
		});

		it("handles deleting file without UID (no-op)", () => {
			// Setup
			const fileWithUid = addMockFile("with-uid.md", "keep-uid");
			const fileWithoutUid = addMockFile("without-uid.md");
			service = createService();

			// Act: delete file without UID
			mockFiles = mockFiles.filter((f) => f.path !== "without-uid.md");
			onDeleteHandler?.(fileWithoutUid);

			// Assert: other file still in index
			expect(service.getFileByUid("keep-uid")?.path).toBe("with-uid.md");
		});
	});

	describe("rename file", () => {
		it("updates path in index when file is renamed", () => {
			// Setup
			const file = addMockFile("old-name.md", "rename-uid");
			service = createService();
			expect(service.getFileByUid("rename-uid")?.path).toBe("old-name.md");

			// Act: simulate rename
			const oldPath = file.path;
			(file as { path: string }).path = "new-name.md";
			mockCacheData.set("new-name.md", mockCacheData.get("old-name.md")!);
			mockCacheData.delete("old-name.md");
			onRenameHandler?.(file, oldPath);

			// Assert
			expect(service.getFileByUid("rename-uid")?.path).toBe("new-name.md");
		});

		it("updates path when file is moved to different folder", () => {
			// Setup
			const file = addMockFile("folder-a/note.md", "move-uid");
			service = createService();

			// Act: simulate move
			const oldPath = file.path;
			(file as { path: string }).path = "folder-b/note.md";
			mockCacheData.set("folder-b/note.md", mockCacheData.get("folder-a/note.md")!);
			mockCacheData.delete("folder-a/note.md");
			onRenameHandler?.(file, oldPath);

			// Assert
			expect(service.getFileByUid("move-uid")?.path).toBe("folder-b/note.md");
		});
	});

	describe("lookup existing UID", () => {
		it("returns TFile for existing UID", () => {
			// Setup
			addMockFile("note.md", "lookup-uid");
			service = createService();

			// Act
			const result = service.getFileByUid("lookup-uid");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.path).toBe("note.md");
			expect(result?.basename).toBe("note");
		});
	});

	describe("lookup non-existing UID", () => {
		it("returns null for non-existing UID", () => {
			// Setup
			addMockFile("note.md", "other-uid");
			service = createService();

			// Act
			const result = service.getFileByUid("non-existing-uid");

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("edge cases", () => {
		it("handles duplicate UIDs (last one wins)", () => {
			// Setup: two files with same UID (shouldn't happen but handle gracefully)
			addMockFile("note1.md", "duplicate-uid");
			addMockFile("note2.md", "duplicate-uid");
			service = createService();

			// Assert: one of them is in index (implementation detail: last one)
			const result = service.getFileByUid("duplicate-uid");
			expect(result).not.toBeNull();
			expect(result?.path).toBe("note2.md");
		});

		it("provides index size for debugging", () => {
			// Setup
			addMockFile("note1.md", "uid-1");
			addMockFile("note2.md", "uid-2");
			addMockFile("note3.md"); // no UID
			service = createService();

			// Assert
			expect(service.size).toBe(2);
		});
	});
});
