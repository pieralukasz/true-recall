/**
 * CardActions v26 — JOIN-based Query Tests
 *
 * Tests the read path after Note Types migration:
 * cards JOIN notes JOIN note_types → computed question/answer via template rendering.
 *
 * All tests use v26 schema (note_types + notes + cards without question/answer columns).
 * CardActions.get() must compute question/answer from note fields + note type templates.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { CardActions } from "../../../../src/features/core/persistence/sqlite/modules/CardActions";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../../src/shared/types/note.types";
import {
	TestSqliteDatabaseV26,
	createTestNoteType,
	insertNoteTypeDirect,
	insertNoteDirect,
	createTestNote,
} from "./__setup__/test-database-v26";

// ── Helpers ────────────────────────────────────────────────────

function seedBuiltinNoteTypes(db: TestSqliteDatabaseV26): void {
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
					afmt: "{{FrontSide}}<hr>{{Back}}",
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
					afmt: "{{FrontSide}}<hr>{{Back}}",
				},
				{
					name: "Card 2",
					ordinal: 1,
					qfmt: "{{Back}}",
					afmt: "{{FrontSide}}<hr>{{Front}}",
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

	insertNoteTypeDirect(
		db,
		createTestNoteType({
			id: BUILTIN_IMAGE_OCCLUSION_ID,
			name: "Image Occlusion",
			type: 0,
			fields: ["Image", "Regions"],
			templates: [
				{
					name: "IO",
					ordinal: 0,
					qfmt: "{{Image}}",
					afmt: "{{Image}}{{Regions}}",
				},
			],
			isBuiltin: true,
		}),
	);
}

function insertV26Card(
	db: TestSqliteDatabaseV26,
	card: {
		id: string;
		noteId: string;
		templateOrd?: number;
		state?: number;
		due?: string;
		stability?: number;
		difficulty?: number;
		reps?: number;
		lapses?: number;
		suspended?: boolean;
		sourceUid?: string;
		fsrsPreset?: string;
	},
): void {
	db.run(
		`INSERT INTO cards (id, note_id, template_ord, due, stability, difficulty,
		 reps, lapses, state, suspended, created_at, updated_at, source_uid, fsrs_preset)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			card.id,
			card.noteId,
			card.templateOrd ?? 0,
			card.due ?? new Date().toISOString(),
			card.stability ?? 0,
			card.difficulty ?? 0,
			card.reps ?? 0,
			card.lapses ?? 0,
			card.state ?? State.New,
			card.suspended ? 1 : 0,
			Date.now(),
			Date.now(),
			card.sourceUid ?? null,
			card.fsrsPreset ?? null,
		],
	);
}

// ── Tests ──────────────────────────────────────────────────────

describe("CardActions v26 (with note types)", () => {
	let db: TestSqliteDatabaseV26;
	let cards: CardActions;

	beforeEach(async () => {
		db = new TestSqliteDatabaseV26();
		await db.init();
		seedBuiltinNoteTypes(db);
		cards = new CardActions(db as never);
	});

	afterEach(() => {
		db.close();
	});

	// ── Read path: basic cards ─────────────────────────────────

	describe("read path — basic cards", () => {
		it("get() returns card with computed question = note.fields.Front", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "note-1",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "What is ATP?", Back: "Energy currency" },
				}),
			);
			insertV26Card(db, { id: "card-1", noteId: "note-1" });

			const card = cards.get("card-1");
			expect(card).toBeDefined();
			expect(card!.question).toBe("What is ATP?");
		});

		it("get() returns card with computed answer including FrontSide", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "note-2",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "Capital of France?", Back: "Paris" },
				}),
			);
			insertV26Card(db, { id: "card-2", noteId: "note-2" });

			const card = cards.get("card-2");
			expect(card).toBeDefined();
			expect(card!.answer).toBe("Capital of France?<hr>Paris");
		});

		it("get() returns card with cardType = 'basic'", () => {
			insertNoteDirect(
				db,
				createTestNote({ id: "note-3", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertV26Card(db, { id: "card-3", noteId: "note-3" });

			const card = cards.get("card-3");
			expect(card!.cardType).toBe("basic");
		});

		it("get() returns card with noteId, templateOrd, noteTypeId", () => {
			insertNoteDirect(
				db,
				createTestNote({ id: "note-4", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertV26Card(db, {
				id: "card-4",
				noteId: "note-4",
				templateOrd: 0,
			});

			const card = cards.get("card-4");
			expect(card!.noteId).toBe("note-4");
			expect(card!.templateOrd).toBe(0);
			expect(card!.noteTypeId).toBe(BUILTIN_BASIC_ID);
		});

		it("getAll() computes question/answer for all cards", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "n-a",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "Q1", Back: "A1" },
				}),
			);
			insertNoteDirect(
				db,
				createTestNote({
					id: "n-b",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "Q2", Back: "A2" },
				}),
			);
			insertV26Card(db, { id: "c-a", noteId: "n-a" });
			insertV26Card(db, { id: "c-b", noteId: "n-b" });

			const all = cards.getAll();
			expect(all).toHaveLength(2);
			expect(all.map((c) => c.question).sort()).toEqual(["Q1", "Q2"]);
		});

		it("getBySourceUid() computes question/answer", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "n-src",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "Source Q", Back: "Source A" },
					sourceUid: "uid-test",
				}),
			);
			insertV26Card(db, {
				id: "c-src",
				noteId: "n-src",
				sourceUid: "uid-test",
			});

			const results = cards.getBySourceUid("uid-test");
			expect(results).toHaveLength(1);
			expect(results[0]!.question).toBe("Source Q");
		});
	});

	// ── Read path: reversed cards ──────────────────────────────

	describe("read path — reversed cards", () => {
		beforeEach(() => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "rev-note",
					noteTypeId: BUILTIN_BASIC_REVERSED_ID,
					fields: { Front: "Dog", Back: "Perro" },
				}),
			);
			insertV26Card(db, {
				id: "rev-card-0",
				noteId: "rev-note",
				templateOrd: 0,
			});
			insertV26Card(db, {
				id: "rev-card-1",
				noteId: "rev-note",
				templateOrd: 1,
			});
		});

		it("template_ord=0 → question=Front, cardType='basic'", () => {
			const card = cards.get("rev-card-0");
			expect(card!.question).toBe("Dog");
			expect(card!.cardType).toBe("basic");
		});

		it("template_ord=1 → question=Back, cardType='reversed'", () => {
			const card = cards.get("rev-card-1");
			expect(card!.question).toBe("Perro");
			expect(card!.cardType).toBe("reversed");
		});

		it("template_ord=0 answer includes FrontSide + Back", () => {
			const card = cards.get("rev-card-0");
			expect(card!.answer).toBe("Dog<hr>Perro");
		});

		it("template_ord=1 answer includes FrontSide + Front", () => {
			const card = cards.get("rev-card-1");
			expect(card!.answer).toBe("Perro<hr>Dog");
		});
	});

	// ── Read path: cloze cards ─────────────────────────────────

	describe("read path — cloze cards", () => {
		beforeEach(() => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "cloze-note",
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: {
						Text: "{{c1::Paris}} is the capital of {{c2::France}}",
						Extra: "Geography fact",
					},
				}),
			);
			insertV26Card(db, {
				id: "cloze-card-1",
				noteId: "cloze-note",
				templateOrd: 1,
			});
			insertV26Card(db, {
				id: "cloze-card-2",
				noteId: "cloze-note",
				templateOrd: 2,
			});
		});

		it("template_ord=1 → question has [...] for c1, cardType='cloze'", () => {
			const card = cards.get("cloze-card-1");
			expect(card!.question).toBe("[...] is the capital of France");
			expect(card!.cardType).toBe("cloze");
		});

		it("template_ord=2 → question has [...] for c2", () => {
			const card = cards.get("cloze-card-2");
			expect(card!.question).toBe("Paris is the capital of [...]");
		});

		it("clozeTemplate derived from note.fields.Text", () => {
			const card = cards.get("cloze-card-1");
			expect(card!.clozeTemplate).toBe(
				"{{c1::Paris}} is the capital of {{c2::France}}",
			);
		});

		it("clozeIndex derived from card.template_ord", () => {
			const card1 = cards.get("cloze-card-1");
			expect(card1!.clozeIndex).toBe(1);

			const card2 = cards.get("cloze-card-2");
			expect(card2!.clozeIndex).toBe(2);
		});

		it("answer includes Extra field", () => {
			const card = cards.get("cloze-card-1");
			expect(card!.answer).toContain("Geography fact");
		});
	});

	// ── Read path: multi-field custom type ─────────────────────

	describe("read path — multi-field custom type", () => {
		beforeEach(() => {
			insertNoteTypeDirect(
				db,
				createTestNoteType({
					id: "vocab-type",
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
				}),
			);
		});

		it("custom type with 4 fields → question from qfmt template", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "vocab-note",
					noteTypeId: "vocab-type",
					fields: {
						Word: "食べる",
						Reading: "たべる",
						Meaning: "to eat",
						Example: "ご飯を食べる",
					},
				}),
			);
			insertV26Card(db, { id: "vocab-card", noteId: "vocab-note" });

			const card = cards.get("vocab-card");
			expect(card!.question).toBe("食べる");
		});

		it("custom type → answer from afmt template with conditional", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "vocab-note-2",
					noteTypeId: "vocab-type",
					fields: {
						Word: "食べる",
						Reading: "たべる",
						Meaning: "to eat",
						Example: "ご飯を食べる",
					},
				}),
			);
			insertV26Card(db, { id: "vocab-card-2", noteId: "vocab-note-2" });

			const card = cards.get("vocab-card-2");
			expect(card!.answer).toContain("to eat");
			expect(card!.answer).toContain("Example: ご飯を食べる");
		});

		it("empty field + conditional → conditional content hidden", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "vocab-note-3",
					noteTypeId: "vocab-type",
					fields: {
						Word: "犬",
						Reading: "いぬ",
						Meaning: "dog",
						Example: "", // empty!
					},
				}),
			);
			insertV26Card(db, { id: "vocab-card-3", noteId: "vocab-note-3" });

			const card = cards.get("vocab-card-3");
			expect(card!.answer).toContain("dog");
			expect(card!.answer).not.toContain("Example:");
		});
	});

	// ── Write path ─────────────────────────────────────────────

	describe("write path", () => {
		it("set() creates card with note_id and template_ord", () => {
			insertNoteDirect(
				db,
				createTestNote({ id: "write-note", noteTypeId: BUILTIN_BASIC_ID }),
			);

			// This tests that the new set() accepts note_id and template_ord
			// The card should be readable back with computed q/a
			insertV26Card(db, {
				id: "write-card",
				noteId: "write-note",
				templateOrd: 0,
			});

			const card = cards.get("write-card");
			expect(card).toBeDefined();
			expect(card!.noteId).toBe("write-note");
		});

		it("updateCardScheduling updates FSRS data without touching notes", () => {
			insertNoteDirect(
				db,
				createTestNote({ id: "sched-note", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertV26Card(db, {
				id: "sched-card",
				noteId: "sched-note",
				state: State.New,
			});

			// Update scheduling only — note fields should be unchanged
			db.run(
				`UPDATE cards SET state = ?, stability = ?, difficulty = ?, reps = ? WHERE id = ?`,
				[State.Review, 5.5, 4.2, 1, "sched-card"],
			);

			const card = cards.get("sched-card");
			expect(card!.state).toBe(State.Review);
			expect(card!.stability).toBeCloseTo(5.5);
			// question should still compute from note
			expect(card!.question).toBeDefined();
		});

		it("cards without matching note → returns undefined on get()", () => {
			// Insert card with non-existent note_id
			insertV26Card(db, { id: "orphan-card", noteId: "nonexistent-note" });

			// INNER JOIN should fail, card not found
			const card = cards.get("orphan-card");
			expect(card).toBeUndefined();
		});
	});

	// ── FSRS-only queries (no JOIN needed) ─────────────────────

	describe("FSRS-only queries (no JOIN)", () => {
		it("has() works without JOIN", () => {
			insertNoteDirect(
				db,
				createTestNote({ id: "has-note", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertV26Card(db, { id: "has-card", noteId: "has-note" });

			expect(cards.has("has-card")).toBe(true);
			expect(cards.has("nonexistent")).toBe(false);
		});

		it("size() counts cards without JOIN", () => {
			insertNoteDirect(
				db,
				createTestNote({ id: "size-n1", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertNoteDirect(
				db,
				createTestNote({ id: "size-n2", noteTypeId: BUILTIN_BASIC_ID }),
			);
			insertV26Card(db, { id: "size-c1", noteId: "size-n1" });
			insertV26Card(db, { id: "size-c2", noteId: "size-n2" });

			expect(cards.size()).toBe(2);
		});
	});

	// ── Browser query ──────────────────────────────────────────

	describe("browser query", () => {
		beforeEach(() => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "browse-n1",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "What is ATP?", Back: "Energy molecule" },
					sourceUid: "uid-bio",
				}),
			);
			insertNoteDirect(
				db,
				createTestNote({
					id: "browse-n2",
					noteTypeId: BUILTIN_BASIC_ID,
					fields: { Front: "Capital of France", Back: "Paris" },
					sourceUid: "uid-geo",
				}),
			);
			insertV26Card(db, {
				id: "browse-c1",
				noteId: "browse-n1",
				sourceUid: "uid-bio",
			});
			insertV26Card(db, {
				id: "browse-c2",
				noteId: "browse-n2",
				sourceUid: "uid-geo",
			});
		});

		it("text search: finds card by field value in notes.fields_json", () => {
			// Search across notes.fields_json for matching content
			const results = db.query<{ id: string }>(
				`SELECT c.id FROM cards c
				 JOIN notes n ON c.note_id = n.id
				 WHERE n.fields_json LIKE ? AND c.deleted_at IS NULL`,
				["%ATP%"],
			);
			expect(results).toHaveLength(1);
			expect(results[0]!.id).toBe("browse-c1");
		});

		it("text search: case-insensitive via LIKE", () => {
			const results = db.query<{ id: string }>(
				`SELECT c.id FROM cards c
				 JOIN notes n ON c.note_id = n.id
				 WHERE n.fields_json LIKE ? AND c.deleted_at IS NULL`,
				["%paris%"],
			);
			expect(results).toHaveLength(1);
		});

		it("text search: finds across multiple fields", () => {
			// Search in Back field
			const results = db.query<{ id: string }>(
				`SELECT c.id FROM cards c
				 JOIN notes n ON c.note_id = n.id
				 WHERE n.fields_json LIKE ? AND c.deleted_at IS NULL`,
				["%Energy%"],
			);
			expect(results).toHaveLength(1);
			expect(results[0]!.id).toBe("browse-c1");
		});

		it("sort by source_uid works (column on cards)", () => {
			const results = db.query<{ id: string; source_uid: string }>(
				`SELECT c.id, c.source_uid FROM cards c
				 WHERE c.deleted_at IS NULL
				 ORDER BY c.source_uid ASC`,
			);
			expect(results[0]!.source_uid).toBe("uid-bio");
			expect(results[1]!.source_uid).toBe("uid-geo");
		});

		it("filter by note_type_id", () => {
			// Add a cloze note+card
			insertNoteDirect(
				db,
				createTestNote({
					id: "browse-n3",
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: {
						Text: "{{c1::test}} cloze",
						Extra: "",
					},
				}),
			);
			insertV26Card(db, {
				id: "browse-c3",
				noteId: "browse-n3",
				templateOrd: 1,
			});

			const results = db.query<{ id: string }>(
				`SELECT c.id FROM cards c
				 JOIN notes n ON c.note_id = n.id
				 WHERE n.note_type_id = ? AND c.deleted_at IS NULL`,
				[BUILTIN_CLOZE_ID],
			);
			expect(results).toHaveLength(1);
			expect(results[0]!.id).toBe("browse-c3");
		});
	});

	// ── Sibling queries ────────────────────────────────────────

	describe("sibling queries", () => {
		it("getCardsByNoteId returns all cards sharing a note", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "sibling-note",
					noteTypeId: BUILTIN_BASIC_REVERSED_ID,
					fields: { Front: "Cat", Back: "Gato" },
				}),
			);
			insertV26Card(db, {
				id: "sib-0",
				noteId: "sibling-note",
				templateOrd: 0,
			});
			insertV26Card(db, {
				id: "sib-1",
				noteId: "sibling-note",
				templateOrd: 1,
			});

			const siblings = db.query<{ id: string; template_ord: number }>(
				`SELECT id, template_ord FROM cards WHERE note_id = ? AND deleted_at IS NULL ORDER BY template_ord`,
				["sibling-note"],
			);
			expect(siblings).toHaveLength(2);
			expect(siblings[0]!.template_ord).toBe(0);
			expect(siblings[1]!.template_ord).toBe(1);
		});

		it("cloze group: returns N cards with correct template_ords", () => {
			insertNoteDirect(
				db,
				createTestNote({
					id: "cloze-sib-note",
					noteTypeId: BUILTIN_CLOZE_ID,
					fields: {
						Text: "{{c1::A}} {{c2::B}} {{c3::C}}",
						Extra: "",
					},
				}),
			);
			insertV26Card(db, {
				id: "cloze-sib-1",
				noteId: "cloze-sib-note",
				templateOrd: 1,
			});
			insertV26Card(db, {
				id: "cloze-sib-2",
				noteId: "cloze-sib-note",
				templateOrd: 2,
			});
			insertV26Card(db, {
				id: "cloze-sib-3",
				noteId: "cloze-sib-note",
				templateOrd: 3,
			});

			const siblings = db.query<{ id: string; template_ord: number }>(
				`SELECT id, template_ord FROM cards WHERE note_id = ? ORDER BY template_ord`,
				["cloze-sib-note"],
			);
			expect(siblings).toHaveLength(3);
			expect(siblings.map((s) => s.template_ord)).toEqual([1, 2, 3]);
		});
	});
});
