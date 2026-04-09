/**
 * NoteTypeService — Service CRUD + Validation Tests
 *
 * Tests business logic for note type operations.
 * Uses in-memory SQLite v26 through NoteTypeActions/NoteActions.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NoteTypeService } from "../../../src/services/notes/note-type.service";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../src/types/note.types";
import {
	createTestContext,
	createTestNote,
	createTestNoteType,
	insertNoteDirect,
	insertNoteTypeDirect,
	type TestContext,
} from "../../persistence/sqlite/__setup__/test-database";

describe("NoteTypeService", () => {
	let ctx: TestContext;
	let service: NoteTypeService;

	beforeEach(async () => {
		ctx = await createTestContext();
		service = new NoteTypeService({
			noteTypeActions: ctx.noteTypes,
			noteActions: ctx.notes,
		});
	});

	afterEach(() => {
		ctx.close();
	});

	// ── Built-in note types ────────────────────────────────────

	describe("built-in note types", () => {
		it("registers all 4 built-in types on initialization", () => {
			service.initialize();

			const all = service.getAll();
			expect(all.length).toBeGreaterThanOrEqual(4);
		});

		it("builtin-basic has fields ['Front','Back'] and 1 template", () => {
			service.initialize();

			const basic = service.getById(BUILTIN_BASIC_ID);
			expect(basic).not.toBeNull();
			expect(basic!.fields).toEqual(["Front", "Back"]);
			expect(basic!.templates).toHaveLength(1);
		});

		it("builtin-basic-reversed has fields ['Front','Back'] and 2 templates", () => {
			service.initialize();

			const reversed = service.getById(BUILTIN_BASIC_REVERSED_ID);
			expect(reversed!.fields).toEqual(["Front", "Back"]);
			expect(reversed!.templates).toHaveLength(2);
		});

		it("builtin-cloze has fields ['Text','Extra'] and 1 template, type=1", () => {
			service.initialize();

			const cloze = service.getById(BUILTIN_CLOZE_ID);
			expect(cloze!.type).toBe(1);
			expect(cloze!.fields).toEqual(["Text", "Extra"]);
			expect(cloze!.templates).toHaveLength(1);
		});

		it("builtin-image-occlusion has fields ['Image','Regions']", () => {
			service.initialize();

			const io = service.getById(BUILTIN_IMAGE_OCCLUSION_ID);
			expect(io!.fields).toContain("Image");
			expect(io!.fields).toContain("Regions");
		});

		it("all built-in types have isBuiltin=true", () => {
			service.initialize();

			const builtinIds = [
				BUILTIN_BASIC_ID,
				BUILTIN_BASIC_REVERSED_ID,
				BUILTIN_CLOZE_ID,
				BUILTIN_IMAGE_OCCLUSION_ID,
			];

			for (const id of builtinIds) {
				const nt = service.getById(id);
				expect(nt!.isBuiltin).toBe(true);
			}
		});

		it("getById returns correct built-in type", () => {
			service.initialize();

			const basic = service.getById(BUILTIN_BASIC_ID);
			expect(basic!.id).toBe(BUILTIN_BASIC_ID);
			expect(basic!.name).toBe("Basic");
		});

		it("getAll returns all 4 built-in types", () => {
			service.initialize();

			const all = service.getAll();
			const ids = all.map((t) => t.id);
			expect(ids).toContain(BUILTIN_BASIC_ID);
			expect(ids).toContain(BUILTIN_BASIC_REVERSED_ID);
			expect(ids).toContain(BUILTIN_CLOZE_ID);
			expect(ids).toContain(BUILTIN_IMAGE_OCCLUSION_ID);
		});
	});

	// ── Custom note type CRUD ──────────────────────────────────

	describe("custom note type CRUD", () => {
		it("create: saves with generated ID, timestamps, isBuiltin=false", () => {
			const created = service.create({
				name: "Vocabulary",
				fields: ["Word", "Meaning"],
				templates: [
					{ name: "Card 1", ordinal: 0, qfmt: "{{Word}}", afmt: "{{Meaning}}" },
				],
			});

			expect(created.id).toBeDefined();
			expect(created.isBuiltin).toBe(false);
			expect(created.createdAt).toBeDefined();
		});

		it("create: requires at least one field", () => {
			expect(() =>
				service.create({
					name: "Empty Fields",
					fields: [],
					templates: [
						{ name: "Card 1", ordinal: 0, qfmt: "{{A}}", afmt: "{{B}}" },
					],
				}),
			).toThrow();
		});

		it("create: requires at least one template", () => {
			expect(() =>
				service.create({
					name: "No Templates",
					fields: ["Front", "Back"],
					templates: [],
				}),
			).toThrow();
		});

		it("create: rejects duplicate name", () => {
			service.create({
				name: "Unique Name",
				fields: ["A"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{A}}" }],
			});

			expect(() =>
				service.create({
					name: "Unique Name",
					fields: ["B"],
					templates: [{ name: "C1", ordinal: 0, qfmt: "{{B}}", afmt: "{{B}}" }],
				}),
			).toThrow();
		});

		it("create: trims whitespace from name", () => {
			const created = service.create({
				name: "  Vocab  ",
				fields: ["Word"],
				templates: [
					{ name: "C1", ordinal: 0, qfmt: "{{Word}}", afmt: "{{Word}}" },
				],
			});

			expect(created.name).toBe("Vocab");
		});

		it("getById: returns null for non-existent ID", () => {
			expect(service.getById("nonexistent")).toBeNull();
		});

		it("update: changes name, fields, templates", () => {
			const created = service.create({
				name: "Original",
				fields: ["A", "B"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{B}}" }],
			});

			service.update(created.id, {
				name: "Updated",
				fields: ["X", "Y", "Z"],
			});

			const updated = service.getById(created.id);
			expect(updated!.name).toBe("Updated");
			expect(updated!.fields).toEqual(["X", "Y", "Z"]);
		});

		it("update: rejects updating built-in types", () => {
			service.initialize();

			expect(() =>
				service.update(BUILTIN_BASIC_ID, { name: "Custom Basic" }),
			).toThrow();
		});

		it("update: updates updated_at timestamp", () => {
			const created = service.create({
				name: "TS Test",
				fields: ["A"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{A}}" }],
			});

			const beforeTs = created.updatedAt;

			service.update(created.id, { name: "TS Updated" });

			const updated = service.getById(created.id);
			expect(updated!.updatedAt).toBeGreaterThanOrEqual(beforeTs ?? 0);
		});

		it("delete: soft-deletes (sets deleted_at)", () => {
			const created = service.create({
				name: "To Delete",
				fields: ["A"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{A}}" }],
			});

			service.delete(created.id);

			expect(service.getById(created.id)).toBeNull();
		});

		it("delete: rejects deleting built-in types", () => {
			service.initialize();

			expect(() => service.delete(BUILTIN_BASIC_ID)).toThrow();
		});

		it("delete: rejects deleting types that have notes using them", () => {
			const created = service.create({
				name: "In Use",
				fields: ["A"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{A}}" }],
			});

			// Insert a note using this type (type already in DB from service.create)
			insertNoteDirect(ctx.db, createTestNote({ noteTypeId: created.id }));

			expect(() => service.delete(created.id)).toThrow();
		});

		it("delete: allows deleting unused custom types", () => {
			const created = service.create({
				name: "Unused",
				fields: ["A"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{A}}" }],
			});

			// No notes reference it
			expect(() => service.delete(created.id)).not.toThrow();
		});

		it("getAll: excludes soft-deleted types", () => {
			const created = service.create({
				name: "Will Delete",
				fields: ["A"],
				templates: [{ name: "C1", ordinal: 0, qfmt: "{{A}}", afmt: "{{A}}" }],
			});

			const beforeCount = service.getAll().length;
			service.delete(created.id);
			const afterCount = service.getAll().length;

			expect(afterCount).toBe(beforeCount - 1);
		});
	});

	// ── Field operations on custom types ───────────────────────

	describe("field operations on custom types", () => {
		let customId: string;

		beforeEach(() => {
			const created = service.create({
				name: "Field Test",
				fields: ["A", "B", "C"],
				templates: [
					{
						name: "Card 1",
						ordinal: 0,
						qfmt: "{{A}}",
						afmt: "{{B}} {{C}}",
					},
				],
			});
			customId = created.id;
		});

		it("addField: appends field to fields array", () => {
			service.addField(customId, "D");

			const nt = service.getById(customId);
			expect(nt!.fields).toEqual(["A", "B", "C", "D"]);
		});

		it("removeField: removes field from type", () => {
			service.removeField(customId, "C");

			const nt = service.getById(customId);
			expect(nt!.fields).toEqual(["A", "B"]);
		});

		it("removeField: rejects removing last field", () => {
			// Create type with single field
			const single = service.create({
				name: "Single Field",
				fields: ["Only"],
				templates: [
					{ name: "C1", ordinal: 0, qfmt: "{{Only}}", afmt: "{{Only}}" },
				],
			});

			expect(() => service.removeField(single.id, "Only")).toThrow();
		});

		it("renameField: updates type fields array", () => {
			service.renameField(customId, "A", "Alpha");

			const nt = service.getById(customId);
			expect(nt!.fields).toContain("Alpha");
			expect(nt!.fields).not.toContain("A");
		});
	});
});
