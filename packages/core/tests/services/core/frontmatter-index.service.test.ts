import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMetadataIndex } from "../../../src/interfaces/metadata-index";
import { FrontmatterIndexService } from "../../../src/services/notes/frontmatter-index.service";

/**
 * Creates a mock IMetadataIndex backed by a simple Map of path → frontmatter.
 * `getAllPathsWithField` returns entries where the field is present (supports dot-notation).
 */
function createMockMetadataIndex(
	fileData: Map<string, Record<string, unknown>>,
): IMetadataIndex {
	function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
		const parts = path.split(".");
		let current: unknown = obj;
		for (const part of parts) {
			if (current == null || typeof current !== "object") return undefined;
			current = (current as Record<string, unknown>)[part];
		}
		return current;
	}

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

describe("FrontmatterIndexService", () => {
	let fileData: Map<string, Record<string, unknown>>;
	let metadataIndex: IMetadataIndex;
	let service: FrontmatterIndexService;

	function addMockFile(
		path: string,
		frontmatter?: Record<string, unknown>,
	): void {
		fileData.set(path, frontmatter ?? {});
	}

	beforeEach(() => {
		fileData = new Map();
	});

	describe("unique string field (like flashcard_uid)", () => {
		beforeEach(() => {
			metadataIndex = createMockMetadataIndex(fileData);
			service = new FrontmatterIndexService(metadataIndex);
			service.register({
				field: "flashcard_uid",
				type: "string",
				unique: true,
			});
		});

		it("indexes unique string field and provides O(1) lookup", () => {
			addMockFile("note1.md", { flashcard_uid: "uid-1" });
			addMockFile("note2.md", { flashcard_uid: "uid-2" });
			addMockFile("note3.md", {}); // no uid

			service.rebuildIndex();

			expect(service.getFileByValue("flashcard_uid", "uid-1")).toBe("note1.md");
			expect(service.getFileByValue("flashcard_uid", "uid-2")).toBe("note2.md");
			expect(service.getFileByValue("flashcard_uid", "uid-3")).toBeNull();
		});

		it("updates index when file metadata changes", () => {
			addMockFile("note.md", { flashcard_uid: "old-uid" });
			service.rebuildIndex();

			expect(service.getFileByValue("flashcard_uid", "old-uid")).toBe(
				"note.md",
			);

			// Simulate UID change via handleMetadataChanged
			fileData.set("note.md", { flashcard_uid: "new-uid" });
			service.handleMetadataChanged("note.md", { flashcard_uid: "new-uid" });

			expect(service.getFileByValue("flashcard_uid", "old-uid")).toBeNull();
			expect(service.getFileByValue("flashcard_uid", "new-uid")).toBe(
				"note.md",
			);
		});

		it("removes from index when file deleted", () => {
			addMockFile("note.md", { flashcard_uid: "uid-1" });
			service.rebuildIndex();

			service.handleFileDeleted("note.md");

			expect(service.getFileByValue("flashcard_uid", "uid-1")).toBeNull();
		});

		it("updates path when file renamed", () => {
			addMockFile("old.md", { flashcard_uid: "uid-1" });
			service.rebuildIndex();

			// Simulate rename
			fileData.set("new.md", fileData.get("old.md")!);
			fileData.delete("old.md");
			service.handleFileRenamed("new.md", "old.md");

			expect(service.getFileByValue("flashcard_uid", "uid-1")).toBe("new.md");
		});
	});

	describe("non-unique array field (like tags)", () => {
		beforeEach(() => {
			metadataIndex = createMockMetadataIndex(fileData);
			service = new FrontmatterIndexService(metadataIndex);
			service.register({ field: "tags", type: "array", unique: false });
		});

		it("indexes array field with multiple values per file", () => {
			addMockFile("note1.md", { tags: ["Tag A", "Tag B"] });
			addMockFile("note2.md", { tags: ["Tag A"] });
			addMockFile("note3.md", { tags: ["Tag C"] });

			service.rebuildIndex();

			const filesA = service.getFilesByValue("tags", "Tag A");
			expect(filesA.sort()).toEqual(["note1.md", "note2.md"]);

			const filesB = service.getFilesByValue("tags", "Tag B");
			expect(filesB).toEqual(["note1.md"]);

			expect(service.getFilesByValue("tags", "Tag D")).toEqual([]);
		});

		it("returns all unique values", () => {
			addMockFile("note1.md", { tags: ["A", "B"] });
			addMockFile("note2.md", { tags: ["B", "C"] });

			service.rebuildIndex();

			const allTags = service.getAllValues("tags");
			expect(allTags).toEqual(new Set(["A", "B", "C"]));
		});

		it("returns values for a specific file path", () => {
			addMockFile("note.md", { tags: ["X", "Y", "Z"] });
			service.rebuildIndex();

			const values = service.getValues("tags", "note.md");
			expect(new Set(values)).toEqual(new Set(["X", "Y", "Z"]));
		});
	});

	describe("nested path field", () => {
		beforeEach(() => {
			metadataIndex = createMockMetadataIndex(fileData);
			service = new FrontmatterIndexService(metadataIndex);
			service.register({
				field: "metadata.category",
				type: "string",
				unique: false,
			});
		});

		it("extracts nested frontmatter values", () => {
			addMockFile("note1.md", { metadata: { category: "science" } });
			addMockFile("note2.md", { metadata: { category: "science" } });
			addMockFile("note3.md", { metadata: { category: "history" } });

			service.rebuildIndex();

			const scienceFiles = service.getFilesByValue(
				"metadata.category",
				"science",
			);
			expect(scienceFiles.sort()).toEqual(["note1.md", "note2.md"]);
		});

		it("handles missing nested path gracefully", () => {
			addMockFile("note1.md", { metadata: {} }); // no category
			addMockFile("note2.md", {}); // no metadata

			service.rebuildIndex();

			expect(service.getAllValues("metadata.category").size).toBe(0);
		});
	});
});
