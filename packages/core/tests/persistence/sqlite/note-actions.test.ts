/**
 * NoteActions — SQL CRUD Tests
 *
 * Tests the persistence layer for notes table.
 * Uses in-memory SQLite (v26 schema).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
} from "../../../src/types/note.types";
import {
	createTestContext,
	createTestNote,
	getRawNote,
	insertNoteDirect,
	type TestContext,
} from "./__setup__/test-database";

describe("NoteActions", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
		// Builtin note types (basic, cloze, etc.) are already seeded by createTestContext()
	});

	afterEach(() => {
		ctx.close();
	});

	// ── CRUD ────────────────────────────────────────────────────

	describe("CRUD", () => {
		it("create: inserts note with all fields", () => {
			const note = createTestNote({
				id: "note-1",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "What is ATP?", Back: "Adenosine triphosphate" },
				tags: ["biology", "energy"],
				sourceUid: "uid-123",
				sourceText: "# ATP\n#flashcard",
				userComment: "Check whether this wording is precise.",
				createdVia: "parser",
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "note-1");
			expect(raw).not.toBeNull();
			expect(raw?.note_type_id).toBe(BUILTIN_BASIC_ID);
			expect(raw?.source_uid).toBe("uid-123");
			expect(raw?.source_text).toBe("# ATP\n#flashcard");
			expect(raw?.user_comment).toBe("Check whether this wording is precise.");
			expect(raw?.created_via).toBe("parser");
		});

		it("create: stores fields_json as valid JSON object", () => {
			const note = createTestNote({
				id: "json-note",
				fields: { Front: "Q", Back: "A" },
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "json-note");
			const fields = JSON.parse(raw?.fields_json as string);
			expect(fields).toEqual({ Front: "Q", Back: "A" });
		});

		it("create: stores tags as space-separated string", () => {
			const note = createTestNote({
				id: "tagged",
				tags: ["biology", "chapter3", "important"],
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "tagged");
			expect(raw?.tags).toBe("biology chapter3 important");
		});

		it("create: sets created_at and updated_at", () => {
			const now = Date.now();
			const note = createTestNote({
				id: "timestamped",
				createdAt: now,
				updatedAt: now,
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "timestamped");
			expect(raw?.created_at).toBe(now);
			expect(raw?.updated_at).toBe(now);
		});

		it("getById: returns note with parsed fields", () => {
			const note = createTestNote({
				id: "fetch-note",
				fields: { Front: "Hello", Back: "World" },
				tags: ["test"],
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("fetch-note");
			expect(result).not.toBeNull();
			expect(result?.id).toBe("fetch-note");
			expect(result?.fields).toEqual({ Front: "Hello", Back: "World" });
			expect(result?.tags).toEqual(["test"]);
		});

		it("getById: returns null for non-existent note", () => {
			const result = ctx.notes.getById("nonexistent");
			expect(result).toBeNull();
		});

		it("getBySourceUid: returns all notes for a source", () => {
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "n1", sourceUid: "uid-A" }),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "n2", sourceUid: "uid-A" }),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "n3", sourceUid: "uid-B" }),
			);

			const results = ctx.notes.getBySourceUid("uid-A");
			expect(results).toHaveLength(2);
			expect(results.map((n) => n.id).sort()).toEqual(["n1", "n2"]);
		});

		it("getByNoteTypeId: returns all notes of a type", () => {
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "basic1", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "basic2", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id: "cloze1",
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: { Text: "{{c1::test}}", Extra: "" },
				}),
			);

			const basics = ctx.notes.getByNoteTypeId(BUILTIN_BASIC_ID);
			expect(basics).toHaveLength(2);

			const clozes = ctx.notes.getByNoteTypeId(BUILTIN_CLOZE_ID);
			expect(clozes).toHaveLength(1);
		});

		it("update: changes fields_json", () => {
			const note = createTestNote({ id: "update-fields" });
			insertNoteDirect(ctx.db, note);

			ctx.notes.update("update-fields", {
				fields: { Front: "Updated Q", Back: "Updated A" },
			});

			const result = ctx.notes.getById("update-fields");
			expect(result?.fields).toEqual({
				Front: "Updated Q",
				Back: "Updated A",
			});
		});

		it("update: changes tags", () => {
			const note = createTestNote({
				id: "update-tags",
				tags: ["old"],
			});
			insertNoteDirect(ctx.db, note);

			ctx.notes.update("update-tags", { tags: ["new", "tags"] });

			const result = ctx.notes.getById("update-tags");
			expect(result?.tags).toEqual(["new", "tags"]);
		});

		it("update: changes and clears the user comment", () => {
			const note = createTestNote({
				id: "update-comment",
				userComment: "Original thought",
			});
			insertNoteDirect(ctx.db, note);

			ctx.notes.update("update-comment", { userComment: "Revised thought" });
			expect(ctx.notes.getById("update-comment")?.userComment).toBe(
				"Revised thought",
			);

			ctx.notes.update("update-comment", { userComment: "" });
			expect(ctx.notes.getById("update-comment")?.userComment).toBeUndefined();
		});

		it("update: updates updated_at timestamp", () => {
			const note = createTestNote({
				id: "update-ts",
				updatedAt: 1000,
			});
			insertNoteDirect(ctx.db, note);

			const before = ctx.notes.getById("update-ts");
			const beforeTs = before?.updatedAt;

			ctx.notes.update("update-ts", {
				fields: { Front: "changed", Back: "too" },
			});

			const after = ctx.notes.getById("update-ts");
			expect(after?.updatedAt).toBeGreaterThanOrEqual(beforeTs ?? 0);
		});

		it("delete: soft-delete (sets deleted_at)", () => {
			const note = createTestNote({ id: "delete-note" });
			insertNoteDirect(ctx.db, note);

			ctx.notes.delete("delete-note");

			const raw = getRawNote(ctx.db, "delete-note");
			expect(raw).not.toBeNull();
			expect(raw?.deleted_at).not.toBeNull();
		});

		it("delete: getById returns null for deleted note", () => {
			const note = createTestNote({ id: "vanish" });
			insertNoteDirect(ctx.db, note);

			ctx.notes.delete("vanish");

			const result = ctx.notes.getById("vanish");
			expect(result).toBeNull();
		});
	});

	// ── Edit counters ───────────────────────────────────────────

	describe("edit counters", () => {
		function seedNote(id: string) {
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id,
					fields: { Front: "Original Q", Back: "Original A" },
				}),
			);
		}

		it("bumps the manual counter and stamps the edit time", () => {
			seedNote("count-manual");

			ctx.notes.update(
				"count-manual",
				{ fields: { Front: "New Q", Back: "Original A" } },
				"manual",
			);

			const note = ctx.notes.getById("count-manual");
			expect(note?.editCount).toBe(1);
			expect(note?.aiEditCount).toBe(0);
			expect(note?.contentEditedAt).toBeGreaterThan(0);
		});

		it("counts nothing when the fields are written back unchanged", () => {
			seedNote("count-noop");

			ctx.notes.update(
				"count-noop",
				{ fields: { Front: "Original Q", Back: "Original A" } },
				"manual",
			);

			const note = ctx.notes.getById("count-noop");
			expect(note?.editCount).toBe(0);
			expect(note?.contentEditedAt).toBeUndefined();
		});

		it("keeps AI edits on their own counter", () => {
			seedNote("count-ai");

			ctx.notes.update(
				"count-ai",
				{ fields: { Front: "Polished Q", Back: "Original A" } },
				"ai",
			);

			const note = ctx.notes.getById("count-ai");
			expect(note?.editCount).toBe(0);
			expect(note?.aiEditCount).toBe(1);
		});

		it("counts neither for system writes but records the edit time", () => {
			seedNote("count-system");

			ctx.notes.update(
				"count-system",
				{ fields: { Front: "Restored Q", Back: "Original A" } },
				"system",
			);

			const note = ctx.notes.getById("count-system");
			expect(note?.editCount).toBe(0);
			expect(note?.aiEditCount).toBe(0);
			expect(note?.contentEditedAt).toBeGreaterThan(0);
		});

		it("accumulates across successive edits", () => {
			seedNote("count-many");

			ctx.notes.update("count-many", { fields: { Front: "Q1", Back: "A" } });
			ctx.notes.update("count-many", { fields: { Front: "Q2", Back: "A" } });
			ctx.notes.update("count-many", { fields: { Front: "Q3", Back: "A" } });

			expect(ctx.notes.getById("count-many")?.editCount).toBe(3);
		});

		it("ignores updates that leave the fields alone", () => {
			seedNote("count-meta-only");

			ctx.notes.update("count-meta-only", { tags: ["new"] });
			ctx.notes.update("count-meta-only", { userComment: "A thought" });

			const note = ctx.notes.getById("count-meta-only");
			expect(note?.editCount).toBe(0);
			expect(note?.contentEditedAt).toBeUndefined();
		});
	});

	// ── fields_json integrity ──────────────────────────────────

	describe("fields_json integrity", () => {
		it("stores and retrieves Record<string, string> faithfully", () => {
			const fields = {
				Word: "食べる",
				Reading: "たべる",
				Meaning: "to eat",
				Example: "ご飯を食べる",
			};
			const note = createTestNote({ id: "faithful", fields });
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("faithful");
			expect(result?.fields).toEqual(fields);
		});

		it("handles empty string values in fields", () => {
			const note = createTestNote({
				id: "empty-vals",
				fields: { Front: "", Back: "" },
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("empty-vals");
			expect(result?.fields).toEqual({ Front: "", Back: "" });
		});

		it("handles fields with markdown content", () => {
			const note = createTestNote({
				id: "markdown",
				fields: {
					Front: "**bold** and _italic_ and `code`",
					Back: "- item 1\n- item 2\n- item 3",
				},
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("markdown");
			expect(result?.fields.Front).toBe("**bold** and _italic_ and `code`");
			expect(result?.fields.Back).toContain("- item 1");
		});

		it("handles fields with special characters (quotes, backslashes)", () => {
			const note = createTestNote({
				id: "special",
				fields: {
					Front: "He said \"hello\" and she said 'hi'",
					Back: "path\\to\\file and a\nnewline",
				},
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("special");
			expect(result?.fields.Front).toBe("He said \"hello\" and she said 'hi'");
			expect(result?.fields.Back).toContain("path\\to\\file");
		});

		it("handles unicode content in fields", () => {
			const note = createTestNote({
				id: "unicode",
				fields: {
					Front: "食べる 🍣 café naïve",
					Back: "Ω ∑ ∫ ∞ π",
				},
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("unicode");
			expect(result?.fields.Front).toBe("食べる 🍣 café naïve");
			expect(result?.fields.Back).toBe("Ω ∑ ∫ ∞ π");
		});

		it("handles very long field values", () => {
			const longValue = "x".repeat(10_000);
			const note = createTestNote({
				id: "long",
				fields: { Front: longValue, Back: "short" },
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("long");
			expect(result?.fields.Front).toHaveLength(10_000);
		});
	});

	// ── Queries ─────────────────────────────────────────────────

	describe("queries", () => {
		it("count: returns total non-deleted notes", () => {
			insertNoteDirect(ctx.db, createTestNote({ id: "c1" }));
			insertNoteDirect(ctx.db, createTestNote({ id: "c2" }));
			insertNoteDirect(ctx.db, createTestNote({ id: "c3" }));
			// Soft-delete one
			ctx.db.run(`UPDATE notes SET deleted_at = ? WHERE id = ?`, [
				Date.now(),
				"c3",
			]);

			const total = ctx.notes.count();
			expect(total).toBe(2);
		});

		it("countByNoteType: correct count per type", () => {
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "b1", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({ id: "b2", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id: "cl1",
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: { Text: "{{c1::test}}", Extra: "" },
				}),
			);

			expect(ctx.notes.countByNoteType(BUILTIN_BASIC_ID)).toBe(2);
			expect(ctx.notes.countByNoteType(BUILTIN_CLOZE_ID)).toBe(1);
		});

		it("search: finds notes matching field values (LIKE query)", () => {
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id: "s1",
					fields: { Front: "What is ATP?", Back: "Adenosine triphosphate" },
				}),
			);
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id: "s2",
					fields: { Front: "What is DNA?", Back: "Deoxyribonucleic acid" },
				}),
			);

			const results = ctx.notes.search("ATP");
			expect(results).toHaveLength(1);
			expect(results[0]?.id).toBe("s1");
		});

		it("search: case-insensitive", () => {
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id: "ci",
					fields: { Front: "Mitochondria", Back: "Powerhouse" },
				}),
			);

			const results = ctx.notes.search("mitochondria");
			expect(results).toHaveLength(1);
		});

		it("search: finds across multiple fields", () => {
			insertNoteDirect(
				ctx.db,
				createTestNote({
					id: "multi",
					fields: { Front: "Question here", Back: "The answer is Paris" },
				}),
			);

			const byBack = ctx.notes.search("Paris");
			expect(byBack).toHaveLength(1);

			const byFront = ctx.notes.search("Question");
			expect(byFront).toHaveLength(1);
		});
	});
});
