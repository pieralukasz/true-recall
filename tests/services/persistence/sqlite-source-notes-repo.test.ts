/**
 * Tests for SqliteSourceNotesRepo
 * Uses in-memory sql.js database for testing
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { SqliteSourceNotesRepo } from "../../../src/services/persistence/sqlite/SqliteSourceNotesRepo";
import { createMockSourceNote } from "../mocks/fsrs.mocks";

describe("SqliteSourceNotesRepo", () => {
	let db: Database;
	let repo: SqliteSourceNotesRepo;
	let onDataChange: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		// Initialize in-memory database
		const SQL = await initSqlJs();
		db = new SQL.Database();
		onDataChange = vi.fn();

		// Create required tables
		db.run(`
			CREATE TABLE source_notes (
				uid TEXT PRIMARY KEY,
				note_name TEXT NOT NULL,
				note_path TEXT,
				deck TEXT DEFAULT 'Knowledge',
				created_at INTEGER,
				updated_at INTEGER
			);

			CREATE TABLE cards (
				id TEXT PRIMARY KEY,
				due TEXT NOT NULL,
				stability REAL DEFAULT 0,
				difficulty REAL DEFAULT 0,
				reps INTEGER DEFAULT 0,
				lapses INTEGER DEFAULT 0,
				state INTEGER DEFAULT 0,
				last_review TEXT,
				scheduled_days INTEGER DEFAULT 0,
				learning_step INTEGER DEFAULT 0,
				suspended INTEGER DEFAULT 0,
				buried_until TEXT,
				created_at INTEGER,
				updated_at INTEGER,
				question TEXT,
				answer TEXT,
				source_uid TEXT,
				tags TEXT
			);

			CREATE INDEX idx_cards_source_uid ON cards(source_uid);
		`);

		repo = new SqliteSourceNotesRepo(db, onDataChange);
	});

	describe("upsert", () => {
		it("should insert a new source note", () => {
			const sourceNote = createMockSourceNote({
				uid: "test-uid-1",
				noteName: "My Note",
				notePath: "notes/my-note.md",
				deck: "Science",
			});

			repo.upsert(sourceNote);

			const result = repo.get("test-uid-1");
			expect(result).not.toBeNull();
			expect(result!.uid).toBe("test-uid-1");
			expect(result!.noteName).toBe("My Note");
			expect(result!.notePath).toBe("notes/my-note.md");
			expect(result!.deck).toBe("Science");
			expect(onDataChange).toHaveBeenCalledTimes(1);
		});

		it("should update an existing source note on conflict", () => {
			const sourceNote = createMockSourceNote({
				uid: "test-uid-1",
				noteName: "Original Name",
				notePath: "notes/original.md",
			});
			repo.upsert(sourceNote);

			const updated = createMockSourceNote({
				uid: "test-uid-1",
				noteName: "Updated Name",
				notePath: "notes/updated.md",
				deck: "History",
			});
			repo.upsert(updated);

			const result = repo.get("test-uid-1");
			expect(result!.noteName).toBe("Updated Name");
			expect(result!.notePath).toBe("notes/updated.md");
			expect(result!.deck).toBe("History");
			expect(onDataChange).toHaveBeenCalledTimes(2);
		});

		it("should handle null notePath", () => {
			// Create source note without using mock factory to test null path behavior
			const sourceNote = {
				uid: "no-path",
				noteName: "Note Without Path",
				notePath: undefined as string | undefined,
				deck: "Knowledge",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			repo.upsert(sourceNote);

			const result = repo.get("no-path");
			expect(result).not.toBeNull();
			// SQLite returns null for NULL values, which is falsy like undefined
			expect(result!.notePath).toBeFalsy();
		});
	});

	describe("get", () => {
		it("should return source note by UID", () => {
			const sourceNote = createMockSourceNote({
				uid: "find-me",
				noteName: "Find Me",
			});
			repo.upsert(sourceNote);

			const result = repo.get("find-me");

			expect(result).not.toBeNull();
			expect(result!.uid).toBe("find-me");
			expect(result!.noteName).toBe("Find Me");
		});

		it("should return null for non-existent UID", () => {
			const result = repo.get("does-not-exist");
			expect(result).toBeNull();
		});
	});

	describe("getByPath", () => {
		it("should return source note by path", () => {
			const sourceNote = createMockSourceNote({
				uid: "path-test",
				noteName: "Path Test",
				notePath: "folder/my-special-note.md",
			});
			repo.upsert(sourceNote);

			const result = repo.getByPath("folder/my-special-note.md");

			expect(result).not.toBeNull();
			expect(result!.uid).toBe("path-test");
			expect(result!.notePath).toBe("folder/my-special-note.md");
		});

		it("should return null for non-existent path", () => {
			repo.upsert(
				createMockSourceNote({
					uid: "some-uid",
					notePath: "notes/existing.md",
				})
			);

			const result = repo.getByPath("notes/non-existent.md");
			expect(result).toBeNull();
		});

		it("should find correct note when multiple notes exist", () => {
			repo.upsert(
				createMockSourceNote({
					uid: "note-1",
					notePath: "folder-a/note.md",
				})
			);
			repo.upsert(
				createMockSourceNote({
					uid: "note-2",
					notePath: "folder-b/note.md",
				})
			);
			repo.upsert(
				createMockSourceNote({
					uid: "note-3",
					notePath: "folder-c/note.md",
				})
			);

			const result = repo.getByPath("folder-b/note.md");

			expect(result).not.toBeNull();
			expect(result!.uid).toBe("note-2");
		});
	});

	describe("getAll", () => {
		it("should return empty array when no source notes exist", () => {
			const result = repo.getAll();
			expect(result).toEqual([]);
		});

		it("should return all source notes", () => {
			repo.upsert(createMockSourceNote({ uid: "uid-1", noteName: "Note 1" }));
			repo.upsert(createMockSourceNote({ uid: "uid-2", noteName: "Note 2" }));
			repo.upsert(createMockSourceNote({ uid: "uid-3", noteName: "Note 3" }));

			const result = repo.getAll();

			expect(result).toHaveLength(3);
			expect(result.map((n) => n.uid).sort()).toEqual(["uid-1", "uid-2", "uid-3"]);
		});
	});

	describe("updatePath", () => {
		it("should update source note path", () => {
			repo.upsert(
				createMockSourceNote({
					uid: "rename-test",
					noteName: "Original",
					notePath: "old/path.md",
				})
			);

			repo.updatePath("rename-test", "new/path.md");

			const result = repo.get("rename-test");
			expect(result!.notePath).toBe("new/path.md");
			expect(result!.noteName).toBe("Original"); // Name unchanged
			expect(onDataChange).toHaveBeenCalled();
		});

		it("should update both path and name when newName provided", () => {
			repo.upsert(
				createMockSourceNote({
					uid: "rename-full",
					noteName: "Old Name",
					notePath: "old/old-name.md",
				})
			);

			repo.updatePath("rename-full", "new/new-name.md", "New Name");

			const result = repo.get("rename-full");
			expect(result!.notePath).toBe("new/new-name.md");
			expect(result!.noteName).toBe("New Name");
		});

		it("should update updatedAt timestamp", () => {
			const originalTime = Date.now() - 10000;
			repo.upsert(
				createMockSourceNote({
					uid: "time-test",
					notePath: "path.md",
					updatedAt: originalTime,
				})
			);

			repo.updatePath("time-test", "new-path.md");

			const result = repo.get("time-test");
			expect(result!.updatedAt).toBeGreaterThan(originalTime);
		});
	});

	describe("delete", () => {
		beforeEach(() => {
			// Set up source note with associated cards
			repo.upsert(
				createMockSourceNote({
					uid: "delete-test",
					noteName: "To Delete",
					notePath: "delete-me.md",
				})
			);

			// Add cards linked to this source note
			db.run(
				`INSERT INTO cards (id, due, source_uid, question, answer)
				 VALUES ('card-1', '2024-01-01', 'delete-test', 'Q1', 'A1')`,
			);
			db.run(
				`INSERT INTO cards (id, due, source_uid, question, answer)
				 VALUES ('card-2', '2024-01-01', 'delete-test', 'Q2', 'A2')`,
			);
			db.run(
				`INSERT INTO cards (id, due, source_uid, question, answer)
				 VALUES ('card-3', '2024-01-01', 'other-uid', 'Q3', 'A3')`,
			);
		});

		it("should delete source note", () => {
			repo.delete("delete-test");

			const result = repo.get("delete-test");
			expect(result).toBeNull();
			expect(onDataChange).toHaveBeenCalled();
		});

		it("should detach cards by default (detachCards=true)", () => {
			repo.delete("delete-test", true);

			// Check cards are detached (source_uid = NULL)
			const result = db.exec(
				"SELECT id, source_uid FROM cards WHERE id IN ('card-1', 'card-2')"
			);
			expect(result[0]!.values).toHaveLength(2);
			for (const row of result[0]!.values) {
				expect(row[1]).toBeNull(); // source_uid should be NULL
			}
		});

		it("should not delete associated cards when detaching", () => {
			repo.delete("delete-test", true);

			// Cards should still exist
			const result = db.exec("SELECT COUNT(*) FROM cards");
			expect(result[0]!.values[0]![0]).toBe(3); // All 3 cards still exist
		});

		it("should not detach cards when detachCards=false", () => {
			repo.delete("delete-test", false);

			// Cards should NOT be detached (source_uid remains)
			const result = db.exec(
				"SELECT source_uid FROM cards WHERE id = 'card-1'"
			);
			expect(result[0]!.values[0]![0]).toBe("delete-test");
		});

		it("should not affect cards from other source notes", () => {
			repo.delete("delete-test", true);

			// card-3 should be unaffected
			const result = db.exec(
				"SELECT source_uid FROM cards WHERE id = 'card-3'"
			);
			expect(result[0]!.values[0]![0]).toBe("other-uid");
		});
	});

	describe("rowToSourceNoteInfo mapping", () => {
		it("should correctly map all fields from database row", () => {
			const now = Date.now();
			repo.upsert({
				uid: "full-mapping",
				noteName: "Full Test",
				notePath: "path/to/note.md",
				deck: "Custom Deck",
				createdAt: now - 1000,
				updatedAt: now,
			});

			const result = repo.get("full-mapping");

			expect(result).toEqual({
				uid: "full-mapping",
				noteName: "Full Test",
				notePath: "path/to/note.md",
				deck: "Custom Deck",
				createdAt: now - 1000,
				updatedAt: expect.any(Number), // Updated by upsert
			});
		});
	});
});
