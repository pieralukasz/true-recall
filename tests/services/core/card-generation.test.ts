/**
 * Card Generation Tests — note → cards derivation logic
 *
 * Given a note and its note type, determines which cards should be created.
 * Pure logic tests, no database needed.
 */
import { describe, expect, it } from "vitest";
import {
	generateCardsForNote,
	detectEmptyCards,
} from "../../../src/features/core/services/card-generation.service";
import type { Note, NoteType } from "../../../src/shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	BUILTIN_CLOZE_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "../../../src/shared/types/note.types";

// ── Helpers ────────────────────────────────────────────────────

function basicNoteType(overrides: Partial<NoteType> = {}): NoteType {
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
		...overrides,
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
			{ name: "Cloze", ordinal: 0, qfmt: "{{cloze:Text}}", afmt: "{{cloze:Text}}<br>{{Extra}}" },
		],
		css: "",
		isBuiltin: true,
	};
}

function ioNoteType(): NoteType {
	return {
		id: BUILTIN_IMAGE_OCCLUSION_ID,
		name: "Image Occlusion",
		type: 0,
		fields: ["Image", "Regions"],
		templates: [
			{ name: "IO", ordinal: 0, qfmt: "{{Image}}", afmt: "{{Image}}{{Regions}}" },
		],
		css: "",
		isBuiltin: true,
	};
}

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: overrides.id ?? "test-note",
		noteTypeId: overrides.noteTypeId ?? BUILTIN_BASIC_ID,
		fields: overrides.fields ?? { Front: "Q", Back: "A" },
		tags: overrides.tags ?? [],
		sourceUid: overrides.sourceUid,
		createdVia: overrides.createdVia ?? "manual",
		...overrides,
	};
}

// ── Tests ──────────────────────────────────────────────────────

describe("card generation from notes", () => {
	// ── Standard note types ────────────────────────────────────

	describe("standard note types", () => {
		it("basic note (1 template) → 1 card with template_ord=0", () => {
			const note = makeNote();
			const cards = generateCardsForNote(note, basicNoteType());

			expect(cards).toHaveLength(1);
			expect(cards[0]!.templateOrd).toBe(0);
		});

		it("reversed note (2 templates) → 2 cards with template_ord=0,1", () => {
			const note = makeNote({
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
			});
			const cards = generateCardsForNote(note, reversedNoteType());

			expect(cards).toHaveLength(2);
			expect(cards[0]!.templateOrd).toBe(0);
			expect(cards[1]!.templateOrd).toBe(1);
		});

		it("custom type with 3 templates → 3 cards", () => {
			const threeTemplate = basicNoteType({
				id: "custom-3",
				templates: [
					{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
					{ name: "Card 2", ordinal: 1, qfmt: "{{Back}}", afmt: "{{Front}}" },
					{ name: "Card 3", ordinal: 2, qfmt: "{{Front}} {{Back}}", afmt: "Combined" },
				],
			});
			const note = makeNote({ noteTypeId: "custom-3" });
			const cards = generateCardsForNote(note, threeTemplate);

			expect(cards).toHaveLength(3);
		});

		it("card IDs are unique", () => {
			const note = makeNote({ noteTypeId: BUILTIN_BASIC_REVERSED_ID });
			const cards = generateCardsForNote(note, reversedNoteType());

			expect(cards[0]!.id).not.toBe(cards[1]!.id);
		});

		it("all cards share same note_id", () => {
			const note = makeNote({
				id: "shared-note",
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
			});
			const cards = generateCardsForNote(note, reversedNoteType());

			expect(cards.every((c) => c.noteId === "shared-note")).toBe(true);
		});

		it("all cards inherit source_uid from note", () => {
			const note = makeNote({ sourceUid: "uid-123" });
			const cards = generateCardsForNote(note, basicNoteType());

			expect(cards[0]!.sourceUid).toBe("uid-123");
		});
	});

	// ── Cloze note types ───────────────────────────────────────

	describe("cloze note types", () => {
		it('"{{c1::text}}" → 1 card with template_ord=1', () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: { Text: "{{c1::Paris}} is the capital", Extra: "" },
			});
			const cards = generateCardsForNote(note, clozeNoteType());

			expect(cards).toHaveLength(1);
			expect(cards[0]!.templateOrd).toBe(1);
		});

		it('"{{c1::a}} {{c2::b}}" → 2 cards, template_ord=1,2', () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: { Text: "{{c1::a}} and {{c2::b}}", Extra: "" },
			});
			const cards = generateCardsForNote(note, clozeNoteType());

			expect(cards).toHaveLength(2);
			expect(cards[0]!.templateOrd).toBe(1);
			expect(cards[1]!.templateOrd).toBe(2);
		});

		it('"{{c1::a}} {{c1::b}}" → 1 card (same index = 1 card)', () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: { Text: "{{c1::a}} and {{c1::b}}", Extra: "" },
			});
			const cards = generateCardsForNote(note, clozeNoteType());

			expect(cards).toHaveLength(1);
			expect(cards[0]!.templateOrd).toBe(1);
		});

		it("text with no cloze markers → 1 card (ensure_not_empty)", () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: { Text: "Plain text with no cloze", Extra: "" },
			});
			const cards = generateCardsForNote(note, clozeNoteType());

			// Anki ensure_not_empty: always generate at least 1 card
			expect(cards.length).toBeGreaterThanOrEqual(1);
		});

		it('"{{c3::text}}" → 1 card with template_ord=3 (gaps OK)', () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: { Text: "Only {{c3::third}} index", Extra: "" },
			});
			const cards = generateCardsForNote(note, clozeNoteType());

			expect(cards).toHaveLength(1);
			expect(cards[0]!.templateOrd).toBe(3);
		});

		it('cloze with hint: "{{c1::answer::hint}}" → 1 card', () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: { Text: "{{c1::Tokyo::capital city}}", Extra: "" },
			});
			const cards = generateCardsForNote(note, clozeNoteType());

			expect(cards).toHaveLength(1);
			expect(cards[0]!.templateOrd).toBe(1);
		});
	});

	// ── Image-occlusion note types ─────────────────────────────

	describe("image-occlusion note types", () => {
		it("regions JSON with 3 regions → 3 cards", () => {
			const regions = JSON.stringify([
				{ id: "r1", x: 0, y: 0, w: 50, h: 50 },
				{ id: "r2", x: 60, y: 0, w: 50, h: 50 },
				{ id: "r3", x: 120, y: 0, w: 50, h: 50 },
			]);
			const note = makeNote({
				noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
				fields: { Image: "path/to/image.png", Regions: regions },
			});
			const cards = generateCardsForNote(note, ioNoteType());

			expect(cards).toHaveLength(3);
		});

		it("each card has sequential template_ord", () => {
			const regions = JSON.stringify([
				{ id: "r1", x: 0, y: 0, w: 50, h: 50 },
				{ id: "r2", x: 60, y: 0, w: 50, h: 50 },
			]);
			const note = makeNote({
				noteTypeId: BUILTIN_IMAGE_OCCLUSION_ID,
				fields: { Image: "img.png", Regions: regions },
			});
			const cards = generateCardsForNote(note, ioNoteType());

			expect(cards[0]!.templateOrd).toBe(0);
			expect(cards[1]!.templateOrd).toBe(1);
		});
	});

	// ── Skip existing ──────────────────────────────────────────

	describe("skip existing", () => {
		it("if card with template_ord=0 already exists, don't create duplicate", () => {
			const note = makeNote();
			const cards = generateCardsForNote(
				note,
				basicNoteType(),
				[0], // template_ord=0 already exists
			);

			expect(cards).toHaveLength(0);
		});

		it("adding new cloze {{c3::}} to existing note → generates only new card", () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: {
					Text: "{{c1::a}} {{c2::b}} {{c3::c}}",
					Extra: "",
				},
			});
			const cards = generateCardsForNote(
				note,
				clozeNoteType(),
				[1, 2], // c1 and c2 already exist
			);

			expect(cards).toHaveLength(1);
			expect(cards[0]!.templateOrd).toBe(3);
		});
	});

	// ── Empty card detection ───────────────────────────────────

	describe("empty card detection — Anki compat", () => {
		it("template where front renders empty → detected as empty", () => {
			const noteType = basicNoteType({
				id: "conditional-type",
				templates: [
					{
						name: "Card 1",
						ordinal: 0,
						qfmt: "{{#Front}}{{Front}}{{/Front}}",
						afmt: "{{Back}}",
					},
				],
			});
			const note = makeNote({
				noteTypeId: "conditional-type",
				fields: { Front: "", Back: "answer" },
			});

			const empty = detectEmptyCards(note, noteType);
			expect(empty).toHaveLength(1);
			expect(empty[0]!.templateOrd).toBe(0);
		});

		it("template referencing non-empty field → not detected as empty", () => {
			const note = makeNote({
				fields: { Front: "Has content", Back: "answer" },
			});

			const empty = detectEmptyCards(note, basicNoteType());
			expect(empty).toHaveLength(0);
		});

		it("detect and report empty cards after field edit", () => {
			const noteType = basicNoteType({
				id: "multi-tmpl",
				templates: [
					{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
					{ name: "Card 2", ordinal: 1, qfmt: "{{#Extra}}{{Extra}}{{/Extra}}", afmt: "{{Back}}" },
				],
				fields: ["Front", "Back", "Extra"],
			});
			const note = makeNote({
				noteTypeId: "multi-tmpl",
				fields: { Front: "Q", Back: "A", Extra: "" },
			});

			const empty = detectEmptyCards(note, noteType);
			// Card 2 should be empty because Extra is empty
			expect(empty.some((e) => e.templateOrd === 1)).toBe(true);
			// Card 1 should NOT be empty
			expect(empty.some((e) => e.templateOrd === 0)).toBe(false);
		});
	});

	// ── Field edit → card regeneration ─────────────────────────

	describe("field edit → card regeneration", () => {
		it("edit that adds cloze {{c3::}} → new card generated", () => {
			const note = makeNote({
				noteTypeId: BUILTIN_CLOZE_ID,
				fields: {
					Text: "{{c1::a}} {{c2::b}} {{c3::new}}",
					Extra: "",
				},
			});

			// Existing cards for c1 and c2
			const newCards = generateCardsForNote(
				note,
				clozeNoteType(),
				[1, 2],
			);

			expect(newCards).toHaveLength(1);
			expect(newCards[0]!.templateOrd).toBe(3);
		});

		it("edit on reversed note → both template_ords generated", () => {
			const note = makeNote({
				noteTypeId: BUILTIN_BASIC_REVERSED_ID,
				fields: { Front: "Updated", Back: "Changed" },
			});
			const cards = generateCardsForNote(note, reversedNoteType());

			// Both cards generated (assuming fresh, no existing)
			expect(cards).toHaveLength(2);
		});
	});
});
