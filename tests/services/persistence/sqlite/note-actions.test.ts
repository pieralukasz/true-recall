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
} from "../../../../src/shared/types/note.types";
import {
	type TestContextV26,
	createTestContextV26,
	createTestNote,
	createTestNoteType,
	getRawNote,
	insertNoteDirect,
	insertNoteTypeDirect,
} from "./__setup__/test-database-v26";

describe("NoteActions", () => {
	let ctx: TestContextV26;

	beforeEach(async () => {
		ctx = await createTestContextV26();
		// Seed a basic note type for FK constraint
		insertNoteTypeDirect(
			ctx.db,
			createTestNoteType({
				id: BUILTIN_BASIC_ID,
				name: "Basic",
				isBuiltin: true,
			}),
		);
		insertNoteTypeDirect(
			ctx.db,
			createTestNoteType({
				id: BUILTIN_CLOZE_ID,
				name: "Cloze",
				type: 1,
				fields: ["Text", "Extra"],
				isBuiltin: true,
			}),
		);
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
				createdVia: "parser",
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "note-1");
			expect(raw).not.toBeNull();
			expect(raw!.note_type_id).toBe(BUILTIN_BASIC_ID);
			expect(raw!.source_uid).toBe("uid-123");
			expect(raw!.source_text).toBe("# ATP\n#flashcard");
			expect(raw!.created_via).toBe("parser");
		});

		it("create: stores fields_json as valid JSON object", () => {
			const note = createTestNote({
				id: "json-note",
				fields: { Front: "Q", Back: "A" },
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "json-note");
			const fields = JSON.parse(raw!.fields_json as string);
			expect(fields).toEqual({ Front: "Q", Back: "A" });
		});

		it("create: stores tags as space-separated string", () => {
			const note = createTestNote({
				id: "tagged",
				tags: ["biology", "chapter3", "important"],
			});

			ctx.notes.create(note);

			const raw = getRawNote(ctx.db, "tagged");
			expect(raw!.tags).toBe("biology chapter3 important");
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
			expect(raw!.created_at).toBe(now);
			expect(raw!.updated_at).toBe(now);
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
			expect(result!.id).toBe("fetch-note");
			expect(result!.fields).toEqual({ Front: "Hello", Back: "World" });
			expect(result!.tags).toEqual(["test"]);
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
			expect(result!.fields).toEqual({
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
			expect(result!.tags).toEqual(["new", "tags"]);
		});

		it("update: updates updated_at timestamp", () => {
			const note = createTestNote({
				id: "update-ts",
				updatedAt: 1000,
			});
			insertNoteDirect(ctx.db, note);

			const before = ctx.notes.getById("update-ts");
			const beforeTs = before!.updatedAt;

			ctx.notes.update("update-ts", {
				fields: { Front: "changed", Back: "too" },
			});

			const after = ctx.notes.getById("update-ts");
			expect(after!.updatedAt).toBeGreaterThanOrEqual(beforeTs ?? 0);
		});

		it("delete: soft-delete (sets deleted_at)", () => {
			const note = createTestNote({ id: "delete-note" });
			insertNoteDirect(ctx.db, note);

			ctx.notes.delete("delete-note");

			const raw = getRawNote(ctx.db, "delete-note");
			expect(raw).not.toBeNull();
			expect(raw!.deleted_at).not.toBeNull();
		});

		it("delete: getById returns null for deleted note", () => {
			const note = createTestNote({ id: "vanish" });
			insertNoteDirect(ctx.db, note);

			ctx.notes.delete("vanish");

			const result = ctx.notes.getById("vanish");
			expect(result).toBeNull();
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
			expect(result!.fields).toEqual(fields);
		});

		it("handles empty string values in fields", () => {
			const note = createTestNote({
				id: "empty-vals",
				fields: { Front: "", Back: "" },
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("empty-vals");
			expect(result!.fields).toEqual({ Front: "", Back: "" });
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
			expect(result!.fields.Front).toBe(
				"**bold** and _italic_ and `code`",
			);
			expect(result!.fields.Back).toContain("- item 1");
		});

		it("handles fields with special characters (quotes, backslashes)", () => {
			const note = createTestNote({
				id: "special",
				fields: {
					Front: 'He said "hello" and she said \'hi\'',
					Back: "path\\to\\file and a\nnewline",
				},
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("special");
			expect(result!.fields.Front).toBe(
				'He said "hello" and she said \'hi\'',
			);
			expect(result!.fields.Back).toContain("path\\to\\file");
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
			expect(result!.fields.Front).toBe("食べる 🍣 café naïve");
			expect(result!.fields.Back).toBe("Ω ∑ ∫ ∞ π");
		});

		it("handles very long field values", () => {
			const longValue = "x".repeat(10_000);
			const note = createTestNote({
				id: "long",
				fields: { Front: longValue, Back: "short" },
			});
			insertNoteDirect(ctx.db, note);

			const result = ctx.notes.getById("long");
			expect(result!.fields.Front).toHaveLength(10_000);
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
			expect(results[0]!.id).toBe("s1");
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
