/**
 * NoteTypeActions — SQL CRUD Tests
 *
 * Tests the persistence layer for note_types table.
 * Uses in-memory SQLite (v26 schema).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NoteTypeActions } from "../../../../src/features/core/persistence/sqlite/modules/NoteTypeActions";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../../src/shared/types/note.types";
import {
	type TestContext,
	createTestContext,
	createTestNoteType,
	getRawNoteType,
	insertNoteTypeDirect,
} from "./__setup__/test-database";

describe("NoteTypeActions", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
	});

	// ── CRUD ────────────────────────────────────────────────────

	describe("CRUD", () => {
		it("create: inserts note type with all fields", () => {
			const noteType = createTestNoteType({
				id: "vocab-type",
				name: "Vocabulary",
				type: 0,
				fields: ["Word", "Reading", "Meaning"],
				templates: [
					{ name: "Recognition", ordinal: 0, qfmt: "{{Word}}", afmt: "{{Meaning}}" },
				],
				css: ".card { font-size: 20px; }",
			});

			ctx.noteTypes.create(noteType);

			const raw = getRawNoteType(ctx.db, "vocab-type");
			expect(raw).not.toBeNull();
			expect(raw!.name).toBe("Vocabulary");
			expect(raw!.type).toBe(0);
			expect(raw!.css).toBe(".card { font-size: 20px; }");
		});

		it("create: fields_json stored as JSON array", () => {
			const noteType = createTestNoteType({
				id: "multi-field",
				fields: ["Front", "Back", "Extra"],
			});

			ctx.noteTypes.create(noteType);

			const raw = getRawNoteType(ctx.db, "multi-field");
			const fields = JSON.parse(raw!.fields_json as string);
			expect(fields).toEqual(["Front", "Back", "Extra"]);
		});

		it("create: templates_json stored as JSON array of objects", () => {
			const templates = [
				{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
				{ name: "Card 2", ordinal: 1, qfmt: "{{Back}}", afmt: "{{Front}}" },
			];
			const noteType = createTestNoteType({
				id: "two-templates",
				templates,
			});

			ctx.noteTypes.create(noteType);

			const raw = getRawNoteType(ctx.db, "two-templates");
			const stored = JSON.parse(raw!.templates_json as string);
			expect(stored).toHaveLength(2);
			expect(stored[0].qfmt).toBe("{{Front}}");
			expect(stored[1].qfmt).toBe("{{Back}}");
		});

		it("getById: returns parsed note type", () => {
			const noteType = createTestNoteType({ id: "fetch-me" });
			insertNoteTypeDirect(ctx.db, noteType);

			const result = ctx.noteTypes.getById("fetch-me");
			expect(result).not.toBeNull();
			expect(result!.id).toBe("fetch-me");
			expect(result!.fields).toEqual(noteType.fields);
			expect(result!.templates).toEqual(noteType.templates);
		});

		it("getById: returns null for non-existent ID", () => {
			const result = ctx.noteTypes.getById("nonexistent");
			expect(result).toBeNull();
		});

		it("getAll: returns all non-deleted types", () => {
			insertNoteTypeDirect(ctx.db, createTestNoteType({ id: "type-1" }));
			insertNoteTypeDirect(ctx.db, createTestNoteType({ id: "type-2" }));

			const all = ctx.noteTypes.getAll();
			// 4 seeded builtins + 2 inserted above
			expect(all).toHaveLength(6);
		});

		it("update: changes name, fields, templates, css", () => {
			const noteType = createTestNoteType({ id: "update-me" });
			insertNoteTypeDirect(ctx.db, noteType);

			ctx.noteTypes.update("update-me", {
				name: "Updated Name",
				fields: ["A", "B", "C"],
				css: ".updated {}",
			});

			const result = ctx.noteTypes.getById("update-me");
			expect(result!.name).toBe("Updated Name");
			expect(result!.fields).toEqual(["A", "B", "C"]);
			expect(result!.css).toBe(".updated {}");
		});

		it("delete: soft-delete (sets deleted_at)", () => {
			const noteType = createTestNoteType({ id: "delete-me" });
			insertNoteTypeDirect(ctx.db, noteType);

			ctx.noteTypes.delete("delete-me");

			const raw = getRawNoteType(ctx.db, "delete-me");
			expect(raw).not.toBeNull();
			expect(raw!.deleted_at).not.toBeNull();
		});

		it("getAll: excludes soft-deleted types", () => {
			insertNoteTypeDirect(ctx.db, createTestNoteType({ id: "alive" }));
			insertNoteTypeDirect(ctx.db, createTestNoteType({ id: "dead" }));
			// Soft-delete one
			ctx.db.run(`UPDATE note_types SET deleted_at = ? WHERE id = ?`, [
				Date.now(),
				"dead",
			]);

			const all = ctx.noteTypes.getAll();
			// 4 seeded builtins + 1 alive (1 soft-deleted excluded)
			expect(all).toHaveLength(5);
			expect(all.map((t) => t.id)).toContain("alive");
			expect(all.map((t) => t.id)).not.toContain("dead");
		});
	});

	// ── Built-in types seeding ─────────────────────────────────

	describe("built-in types seeding", () => {
		it("seedBuiltinTypes: inserts all 4 types", () => {
			ctx.noteTypes.seedBuiltinTypes();

			const all = ctx.noteTypes.getAll();
			expect(all.length).toBeGreaterThanOrEqual(4);

			const ids = all.map((t) => t.id);
			expect(ids).toContain(BUILTIN_BASIC_ID);
			expect(ids).toContain(BUILTIN_BASIC_REVERSED_ID);
			expect(ids).toContain(BUILTIN_CLOZE_ID);
			expect(ids).toContain(BUILTIN_IMAGE_OCCLUSION_ID);
		});

		it("seedBuiltinTypes: idempotent (re-seeding doesn't duplicate)", () => {
			ctx.noteTypes.seedBuiltinTypes();
			ctx.noteTypes.seedBuiltinTypes();

			const all = ctx.noteTypes.getAll();
			const basicCount = all.filter(
				(t) => t.id === BUILTIN_BASIC_ID,
			).length;
			expect(basicCount).toBe(1);
		});

		it("seedBuiltinTypes: all have isBuiltin=true", () => {
			ctx.noteTypes.seedBuiltinTypes();

			const builtinIds = [
				BUILTIN_BASIC_ID,
				BUILTIN_BASIC_REVERSED_ID,
				BUILTIN_CLOZE_ID,
				BUILTIN_IMAGE_OCCLUSION_ID,
			];

			for (const id of builtinIds) {
				const nt = ctx.noteTypes.getById(id);
				expect(nt).not.toBeNull();
				expect(nt!.isBuiltin).toBe(true);
			}
		});

		it("builtin-basic: correct fields and 1 template", () => {
			ctx.noteTypes.seedBuiltinTypes();

			const basic = ctx.noteTypes.getById(BUILTIN_BASIC_ID);
			expect(basic!.fields).toEqual(["Front", "Back"]);
			expect(basic!.templates).toHaveLength(1);
			expect(basic!.type).toBe(0);
		});

		it("builtin-basic-reversed: correct fields and 2 templates", () => {
			ctx.noteTypes.seedBuiltinTypes();

			const reversed = ctx.noteTypes.getById(BUILTIN_BASIC_REVERSED_ID);
			expect(reversed!.fields).toEqual(["Front", "Back"]);
			expect(reversed!.templates).toHaveLength(2);
			expect(reversed!.type).toBe(0);
		});

		it("builtin-cloze: type=1, correct fields and template", () => {
			ctx.noteTypes.seedBuiltinTypes();

			const cloze = ctx.noteTypes.getById(BUILTIN_CLOZE_ID);
			expect(cloze!.type).toBe(1);
			expect(cloze!.fields).toEqual(["Text", "Extra"]);
			expect(cloze!.templates).toHaveLength(1);
		});

		it("builtin-image-occlusion: correct fields", () => {
			ctx.noteTypes.seedBuiltinTypes();

			const io = ctx.noteTypes.getById(BUILTIN_IMAGE_OCCLUSION_ID);
			expect(io!.fields).toContain("Image");
			expect(io!.fields).toContain("Regions");
		});
	});
});
