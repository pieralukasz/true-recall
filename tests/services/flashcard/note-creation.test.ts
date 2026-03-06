/**
 * Note-based card creation/editing tests
 *
 * Tests FlashcardManager.createNote() and updateNoteFields() methods
 * using the v26 test database infrastructure.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
	generateCardsForNote,
} from "../../../src/features/core/services/card-generation.service";
import { renderTemplate } from "../../../src/features/core/services/template-engine";
import { FlashcardManager } from "../../../src/features/study/services/flashcard/flashcard.service";
import type { SqliteStoreService } from "../../../src/features/core/persistence/sqlite/SqliteStoreService";
import type { Note, NoteType } from "../../../src/shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../src/shared/types/note.types";
import type { App } from "obsidian";
import {
	type TestContext,
	createTestContext,
	createTestNoteType,
	createTestNote,
	insertNoteTypeDirect,
	insertNoteDirect,
} from "../../services/persistence/sqlite/__setup__/test-database";

// ── Helpers ────────────────────────────────────────────────────

function basicNoteType(): NoteType {
	return {
		id: BUILTIN_BASIC_ID,
		name: "Basic",
		type: 0,
		fields: ["Front", "Back"],
		templates: [
			{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
		],
		css: "",
		isBuiltin: true,
	};
}

function reversedNoteType(): NoteType {
	return {
		id: BUILTIN_BASIC_REVERSED_ID,
		name: "Basic (reversed)",
		type: 0,
		fields: ["Front", "Back"],
		templates: [
			{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
			{ name: "Card 2", ordinal: 1, qfmt: "{{Back}}", afmt: "{{Front}}" },
		],
		css: "",
		isBuiltin: true,
	};
}

function clozeNoteType(): NoteType {
	return {
		id: BUILTIN_CLOZE_ID,
		name: "Cloze",
		type: 1,
		fields: ["Text", "Extra"],
		templates: [
			{
				name: "Cloze",
				ordinal: 0,
				qfmt: "{{cloze:Text}}",
				afmt: "{{cloze:Text}}<br>{{Extra}}",
			},
		],
		css: "",
		isBuiltin: true,
	};
}

function createMockStore(ctx: TestContext): SqliteStoreService {
	return {
		cards: ctx.cards,
		notes: ctx.notes,
		noteTypes: ctx.noteTypes,
		get: (id: string) => ctx.cards.get(id),
		set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
		has: (id: string) => ctx.cards.has(id),
		isReady: () => true,
	} as unknown as SqliteStoreService;
}

// ── Tests ──────────────────────────────────────────────────────

describe("note-based card creation", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
	});

	describe("generateCardsForNote + renderTemplate integration", () => {
		it("basic note → 1 card with correct Q/A", () => {
			const nt = basicNoteType();
			const note: Note = {
				id: "n1",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "What is ATP?", Back: "Adenosine triphosphate" },
				tags: [],
			};

			const generated = generateCardsForNote(note, nt);
			expect(generated).toHaveLength(1);

			const template = nt.templates[0]!;
			const question = renderTemplate(template.qfmt, { fields: note.fields });
			const answer = renderTemplate(template.afmt, {
				fields: note.fields,
				frontSide: question,
			});

			expect(question).toBe("What is ATP?");
			expect(answer).toBe("Adenosine triphosphate");
		});

		it("reversed note → 2 cards with swapped Q/A", () => {
			const nt = reversedNoteType();
			const note: Note = {
				id: "n2",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "Cat", Back: "Kot" },
				tags: [],
			};

			const generated = generateCardsForNote(note, nt);
			expect(generated).toHaveLength(2);

			// Card 1: Front→Back
			const q1 = renderTemplate(nt.templates[0]!.qfmt, { fields: note.fields });
			const a1 = renderTemplate(nt.templates[0]!.afmt, {
				fields: note.fields,
				frontSide: q1,
			});
			expect(q1).toBe("Cat");
			expect(a1).toBe("Kot");

			// Card 2: Back→Front
			const q2 = renderTemplate(nt.templates[1]!.qfmt, { fields: note.fields });
			const a2 = renderTemplate(nt.templates[1]!.afmt, {
				fields: note.fields,
				frontSide: q2,
			});
			expect(q2).toBe("Kot");
			expect(a2).toBe("Cat");
		});

		it("cloze note → cards per cloze index", () => {
			const nt = clozeNoteType();
			const note: Note = {
				id: "n3",
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: {
					Text: "{{c1::Paris}} is the capital of {{c2::France}}",
					Extra: "Geography",
				},
				tags: [],
			};

			const generated = generateCardsForNote(note, nt);
			expect(generated).toHaveLength(2);
			expect(generated[0]!.templateOrd).toBe(1);
			expect(generated[1]!.templateOrd).toBe(2);
		});

		it("skip existing template ords", () => {
			const nt = reversedNoteType();
			const note: Note = {
				id: "n4",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "Dog", Back: "Pies" },
				tags: [],
			};

			const generated = generateCardsForNote(note, nt, [0]);
			expect(generated).toHaveLength(1);
			expect(generated[0]!.templateOrd).toBe(1);
		});
	});

	describe("note CRUD via NoteActions", () => {
		it("creates and retrieves a note", () => {
			const nt = createTestNoteType({ id: "test-nt-1" });
			insertNoteTypeDirect(ctx.db, nt);

			const note = createTestNote({
				id: "test-n-1",
				noteTypeId: "test-nt-1",
				fields: { Front: "Q1", Back: "A1" },
			});
			ctx.notes.create(note);

			const retrieved = ctx.notes.getById("test-n-1");
			expect(retrieved).not.toBeNull();
			expect(retrieved!.fields).toEqual({ Front: "Q1", Back: "A1" });
			expect(retrieved!.noteTypeId).toBe("test-nt-1");
		});

		it("updates note fields", () => {
			const nt = createTestNoteType({ id: "test-nt-2" });
			insertNoteTypeDirect(ctx.db, nt);

			const note = createTestNote({
				id: "test-n-2",
				noteTypeId: "test-nt-2",
				fields: { Front: "Old Q", Back: "Old A" },
			});
			ctx.notes.create(note);

			ctx.notes.update("test-n-2", {
				fields: { Front: "New Q", Back: "New A" },
			});

			const updated = ctx.notes.getById("test-n-2");
			expect(updated!.fields).toEqual({ Front: "New Q", Back: "New A" });
		});

		it("retrieves notes by note type ID", () => {
			const nt = createTestNoteType({ id: "test-nt-3" });
			insertNoteTypeDirect(ctx.db, nt);

			for (let i = 0; i < 3; i++) {
				ctx.notes.create(
					createTestNote({
						noteTypeId: "test-nt-3",
						fields: { Front: `Q${i}`, Back: `A${i}` },
					}),
				);
			}

			const notes = ctx.notes.getByNoteTypeId("test-nt-3");
			expect(notes).toHaveLength(3);
		});

		it("soft-deletes a note", () => {
			const nt = createTestNoteType({ id: "test-nt-4" });
			insertNoteTypeDirect(ctx.db, nt);

			const note = createTestNote({
				id: "test-n-del",
				noteTypeId: "test-nt-4",
			});
			ctx.notes.create(note);

			ctx.notes.delete("test-n-del");

			const retrieved = ctx.notes.getById("test-n-del");
			expect(retrieved).toBeNull();
		});
	});

	describe("custom note types with multi-field templates", () => {
		it("3-field note type renders all fields", () => {
			const nt: NoteType = {
				id: "custom-lang",
				name: "Language",
				type: 0,
				fields: ["Word", "Translation", "Example"],
				templates: [
					{
						name: "Word → Translation",
						ordinal: 0,
						qfmt: "{{Word}}",
						afmt: "{{Translation}}<br>{{Example}}",
					},
					{
						name: "Translation → Word",
						ordinal: 1,
						qfmt: "{{Translation}}",
						afmt: "{{Word}}<br>{{Example}}",
					},
				],
				css: "",
				isBuiltin: false,
			};

			const note: Note = {
				id: "n-lang-1",
				noteTypeId: "custom-lang",
				fields: {
					Word: "Haus",
					Translation: "House",
					Example: "Das Haus ist groß",
				},
				tags: [],
			};

			const generated = generateCardsForNote(note, nt);
			expect(generated).toHaveLength(2);

			// Card 1: Word → Translation
			const q1 = renderTemplate(nt.templates[0]!.qfmt, { fields: note.fields });
			const a1 = renderTemplate(nt.templates[0]!.afmt, {
				fields: note.fields,
				frontSide: q1,
			});
			expect(q1).toBe("Haus");
			expect(a1).toBe("House<br>Das Haus ist groß");

			// Card 2: Translation → Word
			const q2 = renderTemplate(nt.templates[1]!.qfmt, { fields: note.fields });
			const a2 = renderTemplate(nt.templates[1]!.afmt, {
				fields: note.fields,
				frontSide: q2,
			});
			expect(q2).toBe("House");
			expect(a2).toBe("Haus<br>Das Haus ist groß");
		});
	});

	describe("image occlusion create/update reconciliation", () => {
		it("createImageOcclusionNote creates one card per group key", () => {
			const manager = new FlashcardManager({} as App, {} as never, {} as never);
			manager.setStore(createMockStore(ctx));

			const result = manager.createImageOcclusionNote({
				imagePath: "images/map.png",
				definition: {
					version: 1,
					maskMode: "solo",
					regions: [
						{
							id: "r1",
							x: 0.1,
							y: 0.1,
							w: 0.2,
							h: 0.2,
							groupKey: "0",
							shape: "rect",
						},
						{
							id: "r2",
							x: 0.5,
							y: 0.1,
							w: 0.2,
							h: 0.2,
							groupKey: "1",
							shape: "ellipse",
						},
					],
				},
			});

			expect(result.note.noteTypeId).toBe(BUILTIN_IMAGE_OCCLUSION_ID);
			expect(result.cards).toHaveLength(2);

			const stored = ctx.cards.getCardsByNoteId(result.note.id);
			expect(stored).toHaveLength(2);
			expect(stored.map((card) => card.templateOrd).sort()).toEqual([0, 1]);
			expect(stored.every((card) => card.cardType === "image-occlusion")).toBe(
				true,
			);
		});

		it("updateImageOcclusionNote keeps unchanged ord, creates new, soft-deletes removed", () => {
			const manager = new FlashcardManager({} as App, {} as never, {} as never);
			manager.setStore(createMockStore(ctx));

			const created = manager.createImageOcclusionNote({
				imagePath: "images/atlas.png",
				definition: {
					version: 1,
					maskMode: "solo",
					regions: [
						{
							id: "r0",
							x: 0.1,
							y: 0.1,
							w: 0.2,
							h: 0.2,
							groupKey: "0",
							shape: "rect",
						},
						{
							id: "r1",
							x: 0.5,
							y: 0.1,
							w: 0.2,
							h: 0.2,
							groupKey: "1",
							shape: "rect",
						},
					],
				},
			});

			const beforeCards = ctx.cards.getCardsByNoteId(created.note.id);
			const cardOrd0 = beforeCards.find((card) => card.templateOrd === 0)!;
			const cardOrd1 = beforeCards.find((card) => card.templateOrd === 1)!;

			const updated = manager.updateImageOcclusionNote(created.note.id, {
				imagePath: "images/atlas.png",
				definition: {
					version: 1,
					maskMode: "all",
					regions: [
						{
							id: "r0",
							x: 0.12,
							y: 0.12,
							w: 0.22,
							h: 0.22,
							groupKey: "0",
							shape: "rect",
						},
						{
							id: "r2",
							x: 0.3,
							y: 0.55,
							w: 0.2,
							h: 0.2,
							groupKey: "2",
							shape: "ellipse",
						},
					],
				},
			});

			const activeCards = ctx.cards.getCardsByNoteId(created.note.id);
			expect(activeCards.map((card) => card.templateOrd).sort()).toEqual([0, 2]);
			const keptOrd0 = activeCards.find((card) => card.templateOrd === 0)!;
			expect(keptOrd0.id).toBe(cardOrd0.id);
			expect(updated.updatedCardIds).toContain(cardOrd0.id);
			expect(updated.updatedCardIds).not.toContain(cardOrd1.id);

			const deletedRow = ctx.db.get<{ deleted_at: number | null }>(
				`SELECT deleted_at FROM cards WHERE id = ?`,
				[cardOrd1.id],
			);
			expect(deletedRow?.deleted_at).not.toBeNull();
		});
	});
});
