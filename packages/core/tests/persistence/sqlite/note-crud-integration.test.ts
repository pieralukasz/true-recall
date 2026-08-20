/**
 * Note CRUD Integration Tests
 *
 * End-to-end: create note type → create note → generate cards →
 * read back with computed q/a → edit → verify.
 *
 * These tests exercise the full vertical slice through the system,
 * ensuring all layers work together correctly.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CardActions } from "../../../src/persistence/sqlite/modules/CardActions";
import { NoteActions } from "../../../src/persistence/sqlite/modules/NoteActions";
import { generateCardsForNote } from "../../../src/services/cards/card-generation.service";
import { renderTemplate } from "../../../src/services/cards/template-engine";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
} from "../../../src/types/note.types";
import {
	createTestNote,
	createTestNoteType,
	insertNoteDirect,
	insertNoteTypeDirect,
	TestSqliteDatabase,
} from "./__setup__/test-database";

// ── Helpers ────────────────────────────────────────────────────

function insertV26Card(
	db: TestSqliteDatabase,
	card: {
		id: string;
		noteId: string;
		templateOrd?: number;
		sourceUid?: string;
	},
): void {
	db.run(
		`INSERT INTO cards (id, note_id, template_ord, due, created_at, updated_at, source_uid)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			card.id,
			card.noteId,
			card.templateOrd ?? 0,
			new Date().toISOString(),
			Date.now(),
			Date.now(),
			card.sourceUid ?? null,
		],
	);
}

function seedBuiltinTypes(db: TestSqliteDatabase): void {
	insertNoteTypeDirect(
		db,
		createTestNoteType({
			id: BUILTIN_BASIC_ID,
			name: "Basic",
			type: 0,
			fields: ["Front", "Back"],
			templates: [
				{
					name: "Card 1",
					ordinal: 0,
					qfmt: "{{Front}}",
					afmt: "{{Back}}",
				},
			],
			isBuiltin: true,
		}),
	);

	insertNoteTypeDirect(
		db,
		createTestNoteType({
			id: BUILTIN_BASIC_REVERSED_ID,
			name: "Basic (reversed)",
			type: 0,
			fields: ["Front", "Back"],
			templates: [
				{
					name: "Card 1",
					ordinal: 0,
					qfmt: "{{Front}}",
					afmt: "{{Back}}",
				},
				{
					name: "Card 2",
					ordinal: 1,
					qfmt: "{{Back}}",
					afmt: "{{Front}}",
				},
			],
			isBuiltin: true,
		}),
	);

	insertNoteTypeDirect(
		db,
		createTestNoteType({
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
			isBuiltin: true,
		}),
	);
}

// ── Tests ──────────────────────────────────────────────────────

describe("Note CRUD Integration", () => {
	let db: TestSqliteDatabase;
	let noteActions: NoteActions;
	let cardActions: CardActions;

	beforeEach(async () => {
		db = new TestSqliteDatabase();
		await db.init();
		seedBuiltinTypes(db);
		noteActions = new NoteActions(db as never);
		cardActions = new CardActions(db as never);
	});

	afterEach(() => {
		db.close();
	});

	// ── Create basic flashcard e2e ─────────────────────────────

	describe("create basic flashcard end-to-end", () => {
		it("exposes the note user comment on its generated card", () => {
			const note = createTestNote({
				id: "commented-note",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "Question", Back: "Answer" },
				userComment: "Verify this distinction against the source.",
			});
			insertNoteDirect(db, note);
			insertV26Card(db, { id: "commented-card", noteId: note.id });

			const card = cardActions.get("commented-card");
			expect(card?.userComment).toBe(
				"Verify this distinction against the source.",
			);
		});

		it("create note → generate card → read back computed q/a", () => {
			const noteType = createTestNoteType({
				id: BUILTIN_BASIC_ID,
				fields: ["Front", "Back"],
				templates: [
					{
						name: "Card 1",
						ordinal: 0,
						qfmt: "{{Front}}",
						afmt: "{{Back}}",
					},
				],
			});

			const note = createTestNote({
				id: "e2e-note-1",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "What is ATP?", Back: "Adenosine triphosphate" },
			});
			insertNoteDirect(db, note);

			// Generate cards
			const generated = generateCardsForNote(note, noteType);
			expect(generated).toHaveLength(1);

			// Insert generated card
			insertV26Card(db, {
				id: generated[0]?.id ?? "",
				noteId: note.id,
				templateOrd: generated[0]?.templateOrd,
			});

			// Verify card exists in DB
			const cardRow = db.get<{ note_id: string; template_ord: number }>(
				`SELECT note_id, template_ord FROM cards WHERE id = ?`,
				[generated[0]?.id],
			);
			expect(cardRow?.note_id).toBe("e2e-note-1");

			// Compute question/answer via template engine
			const question = renderTemplate(noteType.templates[0]?.qfmt ?? "", {
				fields: note.fields,
			});
			expect(question).toBe("What is ATP?");

			const answer = renderTemplate(noteType.templates[0]?.afmt ?? "", {
				fields: note.fields,
			});
			expect(answer).toBe("Adenosine triphosphate");
		});

		it("edit note Front field → computed question changes", () => {
			const note = createTestNote({
				id: "e2e-edit-note",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "Original Q", Back: "Original A" },
			});
			insertNoteDirect(db, note);
			insertV26Card(db, { id: "e2e-edit-card", noteId: note.id });

			// Simulate field edit
			const updatedFields = { Front: "Updated Question", Back: "Original A" };
			db.run(`UPDATE notes SET fields_json = ? WHERE id = ?`, [
				JSON.stringify(updatedFields),
				note.id,
			]);

			// Re-read and re-render
			const noteRow = db.get<{ fields_json: string }>(
				`SELECT fields_json FROM notes WHERE id = ?`,
				[note.id],
			);
			const fields = JSON.parse(noteRow?.fields_json as string);

			const question = renderTemplate("{{Front}}", { fields });
			expect(question).toBe("Updated Question");
		});
	});

	// ── Create reversed pair e2e ───────────────────────────────

	describe("create reversed pair end-to-end", () => {
		it("create note → 2 cards generated", () => {
			const noteType = createTestNoteType({
				id: BUILTIN_BASIC_REVERSED_ID,
				fields: ["Front", "Back"],
				templates: [
					{
						name: "Card 1",
						ordinal: 0,
						qfmt: "{{Front}}",
						afmt: "{{Back}}",
					},
					{
						name: "Card 2",
						ordinal: 1,
						qfmt: "{{Back}}",
						afmt: "{{Front}}",
					},
				],
			});

			const note = createTestNote({
				id: "rev-e2e-note",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "Dog", Back: "Perro" },
			});
			insertNoteDirect(db, note);

			const generated = generateCardsForNote(note, noteType);
			expect(generated).toHaveLength(2);
			expect(generated[0]?.templateOrd).toBe(0);
			expect(generated[1]?.templateOrd).toBe(1);
		});

		it("card 0: question=Front, card 1: question=Back", () => {
			const note = createTestNote({
				id: "rev-qa-note",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "Cat", Back: "Gato" },
			});

			const q0 = renderTemplate("{{Front}}", { fields: note.fields });
			expect(q0).toBe("Cat");

			const q1 = renderTemplate("{{Back}}", { fields: note.fields });
			expect(q1).toBe("Gato");
		});

		it("edit Front → both cards reflect change", () => {
			const fields = { Front: "Updated", Back: "Gato" };

			const q0 = renderTemplate("{{Front}}", { fields });
			expect(q0).toBe("Updated");

			const q1 = renderTemplate("{{Back}}", { fields });
			expect(q1).toBe("Gato");

			// {{FrontSide}} is stripped (True Recall shows Q/A separately)
			const a0 = renderTemplate("{{FrontSide}}<hr>{{Back}}", {
				fields,
				frontSide: "",
			});
			expect(a0).toBe("<hr>Gato");
		});
	});

	// ── Create cloze e2e ───────────────────────────────────────

	describe("create cloze end-to-end", () => {
		it("create note → cards for each cloze index", () => {
			const noteType = createTestNoteType({
				id: BUILTIN_CLOZE_ID,
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
			});

			const note = createTestNote({
				id: "cloze-e2e-note",
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: {
					Text: "{{c1::Paris}} is the capital of {{c2::France}}",
					Extra: "Geography",
				},
			});
			insertNoteDirect(db, note);

			const generated = generateCardsForNote(note, noteType);
			expect(generated).toHaveLength(2);
			expect(generated[0]?.templateOrd).toBe(1);
			expect(generated[1]?.templateOrd).toBe(2);
		});

		it("card 1 question: '[...] is the capital of France'", () => {
			const fields = {
				Text: "{{c1::Paris}} is the capital of {{c2::France}}",
				Extra: "Geography",
			};

			const q = renderTemplate("{{cloze:Text}}", {
				fields,
				clozeIndex: 1,
			});
			expect(q).toBe("[...] is the capital of France");
		});

		it("card 1 answer: '**Paris** is the capital of France'", () => {
			const fields = {
				Text: "{{c1::Paris}} is the capital of {{c2::France}}",
				Extra: "Geography",
			};

			const frontSide = "[...] is the capital of France";
			const a = renderTemplate("{{cloze:Text}}<br>{{Extra}}", {
				fields,
				clozeIndex: 1,
				frontSide,
			});
			expect(a).toBe("**Paris** is the capital of France<br>Geography");
		});

		it("card 2 question: 'Paris is the capital of [...]'", () => {
			const fields = {
				Text: "{{c1::Paris}} is the capital of {{c2::France}}",
				Extra: "Geography",
			};

			const q = renderTemplate("{{cloze:Text}}", {
				fields,
				clozeIndex: 2,
			});
			expect(q).toBe("Paris is the capital of [...]");
		});

		it("edit Text to add {{c3::Europe}} → 3rd card generated", () => {
			const noteType = createTestNoteType({
				id: BUILTIN_CLOZE_ID,
				type: 1,
				fields: ["Text", "Extra"],
				templates: [
					{
						name: "Cloze",
						ordinal: 0,
						qfmt: "{{cloze:Text}}",
						afmt: "{{cloze:Text}}",
					},
				],
			});

			const note = createTestNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: {
					Text: "{{c1::Paris}} in {{c2::France}} in {{c3::Europe}}",
					Extra: "",
				},
			});

			// Only c1 and c2 cards exist
			const newCards = generateCardsForNote(note, noteType, [1, 2]);
			expect(newCards).toHaveLength(1);
			expect(newCards[0]?.templateOrd).toBe(3);
		});
	});

	// ── Create custom multi-field e2e ──────────────────────────

	describe("create custom multi-field end-to-end", () => {
		it("Vocabulary type: qfmt='{{Word}}', afmt='{{Meaning}}<br>{{Example}}'", () => {
			const vocabType = createTestNoteType({
				id: "vocab",
				name: "Vocabulary",
				type: 0,
				fields: ["Word", "Reading", "Meaning", "Example"],
				templates: [
					{
						name: "Recognition",
						ordinal: 0,
						qfmt: "{{Word}}",
						afmt: "{{Meaning}}<br>{{#Example}}Example: {{Example}}{{/Example}}",
					},
				],
			});
			insertNoteTypeDirect(db, vocabType);

			const note = createTestNote({
				id: "vocab-note",
				noteTypeId: "vocab",
				fields: {
					Word: "食べる",
					Reading: "たべる",
					Meaning: "to eat",
					Example: "ご飯を食べる",
				},
			});
			insertNoteDirect(db, note);

			const q = renderTemplate("{{Word}}", { fields: note.fields });
			expect(q).toBe("食べる");

			const a = renderTemplate(
				"{{Meaning}}<br>{{#Example}}Example: {{Example}}{{/Example}}",
				{ fields: note.fields },
			);
			expect(a).toBe("to eat<br>Example: ご飯を食べる");
		});

		it("conditional: empty Example → hidden", () => {
			const fields = {
				Word: "犬",
				Reading: "いぬ",
				Meaning: "dog",
				Example: "",
			};

			const a = renderTemplate(
				"{{Meaning}}<br>{{#Example}}Example: {{Example}}{{/Example}}",
				{ fields },
			);
			expect(a).toBe("dog<br>");
			expect(a).not.toContain("Example:");
		});
	});

	// ── Multi-template custom type ─────────────────────────────

	describe("multi-template custom type", () => {
		it("Vocab with 2 templates → 1 note → 2 cards", () => {
			const vocabType = createTestNoteType({
				id: "vocab-2t",
				name: "Vocab 2T",
				type: 0,
				fields: ["Word", "Meaning"],
				templates: [
					{
						name: "Recognition",
						ordinal: 0,
						qfmt: "{{Word}}",
						afmt: "{{Meaning}}",
					},
					{
						name: "Recall",
						ordinal: 1,
						qfmt: "{{Meaning}}",
						afmt: "{{Word}}",
					},
				],
			});

			const note = createTestNote({
				noteTypeId: "vocab-2t",
				fields: { Word: "cat", Meaning: "gato" },
			});

			const generated = generateCardsForNote(note, vocabType);
			expect(generated).toHaveLength(2);

			// Card 0: Recognition
			const q0 = renderTemplate("{{Word}}", { fields: note.fields });
			expect(q0).toBe("cat");

			// Card 1: Recall
			const q1 = renderTemplate("{{Meaning}}", { fields: note.fields });
			expect(q1).toBe("gato");
		});
	});

	// ── Concurrent operations ──────────────────────────────────

	describe("concurrent operations", () => {
		it("create 50 notes with different types → all cards generated", () => {
			const basicType = createTestNoteType({
				id: BUILTIN_BASIC_ID,
				fields: ["Front", "Back"],
				templates: [
					{ name: "C1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
				],
			});

			const clozeType = createTestNoteType({
				id: BUILTIN_CLOZE_ID,
				type: 1,
				fields: ["Text", "Extra"],
				templates: [
					{
						name: "Cloze",
						ordinal: 0,
						qfmt: "{{cloze:Text}}",
						afmt: "{{cloze:Text}}",
					},
				],
			});

			let totalCards = 0;

			for (let i = 0; i < 25; i++) {
				const note = createTestNote({
					id: `bulk-basic-${i}`,
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: `Q${i}`, Back: `A${i}` },
				});
				insertNoteDirect(db, note);
				const cards = generateCardsForNote(note, basicType);
				totalCards += cards.length;
				for (const c of cards) {
					insertV26Card(db, {
						id: c.id,
						noteId: note.id,
						templateOrd: c.templateOrd,
					});
				}
			}

			for (let i = 0; i < 25; i++) {
				const note = createTestNote({
					id: `bulk-cloze-${i}`,
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: {
						Text: `{{c1::A${i}}} and {{c2::B${i}}}`,
						Extra: "",
					},
				});
				insertNoteDirect(db, note);
				const cards = generateCardsForNote(note, clozeType);
				totalCards += cards.length;
				for (const c of cards) {
					insertV26Card(db, {
						id: c.id,
						noteId: note.id,
						templateOrd: c.templateOrd,
					});
				}
			}

			// 25 basic (1 card each) + 25 cloze (2 cards each) = 75
			expect(totalCards).toBe(75);

			const dbCount = db.get<{ cnt: number }>(
				`SELECT COUNT(*) as cnt FROM cards`,
			);
			expect(dbCount?.cnt).toBe(75);
		});
	});

	// ── Change note type ──────────────────────────────────────

	describe("change note type", () => {
		it("Basic → custom 3-field type remaps fields correctly", () => {
			const vocabType = createTestNoteType({
				id: "vocab-change",
				name: "Vocab",
				type: 0,
				fields: ["Word", "Meaning", "Example"],
				templates: [
					{
						name: "Card 1",
						ordinal: 0,
						qfmt: "{{Word}}",
						afmt: "{{Meaning}}",
					},
				],
			});
			insertNoteTypeDirect(db, vocabType);

			const note = createTestNote({
				id: "change-basic-note",
				noteTypeId: BUILTIN_BASIC_ID,
				fields: { Front: "Hello", Back: "Hola" },
			});
			insertNoteDirect(db, note);
			insertV26Card(db, {
				id: "card-change-1",
				noteId: note.id,
				templateOrd: 0,
			});

			// Change type: Front → Word, Back → Meaning
			noteActions.update(note.id, {
				noteTypeId: vocabType.id,
				fields: { Word: "Hello", Meaning: "Hola", Example: "" },
			});

			const updated = noteActions.getById(note.id);
			expect(updated?.noteTypeId).toBe("vocab-change");
			expect(updated?.fields).toEqual({
				Word: "Hello",
				Meaning: "Hola",
				Example: "",
			});
		});

		it("Basic-Reversed → Basic: card with ord=1 becomes orphan", () => {
			const note = createTestNote({
				id: "rev-to-basic-note",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "Cat", Back: "Gato" },
			});
			insertNoteDirect(db, note);
			insertV26Card(db, { id: "rev-card-0", noteId: note.id, templateOrd: 0 });
			insertV26Card(db, { id: "rev-card-1", noteId: note.id, templateOrd: 1 });

			// Change to Basic (1 template, only ord 0)
			noteActions.update(note.id, { noteTypeId: BUILTIN_BASIC_ID });

			const basicType = createTestNoteType({
				id: BUILTIN_BASIC_ID,
				type: 0,
				fields: ["Front", "Back"],
				templates: [
					{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
				],
			});
			const updatedNote = noteActions.getById(note.id);
			if (!updatedNote) throw new Error("expected note to exist after update");

			// Basic has only ord 0
			const desiredCards = generateCardsForNote(updatedNote, basicType);
			const desiredOrds = new Set(desiredCards.map((c) => c.templateOrd));
			expect(desiredOrds).toEqual(new Set([0]));

			const existingCards = cardActions.getCardsByNoteId(note.id);
			expect(existingCards).toHaveLength(2); // ord 0 and ord 1 still in DB

			const orphans = existingCards.filter(
				(c) => !desiredOrds.has(c.templateOrd ?? 0),
			);
			expect(orphans).toHaveLength(1);
			expect(orphans[0]?.templateOrd).toBe(1);
		});

		it("getNoteInfoForCardIds returns unique note+type pairs", () => {
			const note = createTestNote({
				id: "info-note",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "A", Back: "B" },
			});
			insertNoteDirect(db, note);
			insertV26Card(db, { id: "info-card-0", noteId: note.id, templateOrd: 0 });
			insertV26Card(db, { id: "info-card-1", noteId: note.id, templateOrd: 1 });

			const infos = cardActions.getNoteInfoForCardIds([
				"info-card-0",
				"info-card-1",
			]);
			expect(infos).toHaveLength(1);
			expect(infos[0]?.noteId).toBe("info-note");
			expect(infos[0]?.noteTypeId).toBe(BUILTIN_BASIC_REVERSED_ID);
		});
	});
});
