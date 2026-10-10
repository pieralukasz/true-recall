import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardEditHistoryActions } from "../../../src/persistence/sqlite/modules/CardEditHistoryActions";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

describe("local card edit history", () => {
	let ctx: TestContext;
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-10T10:00:00Z"));
		ctx = await createTestContext();
		ctx.cards.set(
			"card",
			createTestCard({ id: "card", question: "Before", answer: "Answer" }),
		);
	});
	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});
	it("rolls back fields and counters if recording fails", () => {
		ctx.db.run(
			"CREATE TRIGGER fail_history BEFORE INSERT ON card_edit_history BEGIN SELECT RAISE(ABORT, 'history failed'); END",
		);
		expect(() => ctx.cards.updateCardContent("card", "Lost", "Answer")).toThrow(
			"history failed",
		);
		expect(ctx.cards.get("card")).toMatchObject({
			question: "Before",
			editCount: 0,
		});
		expect(ctx.db.query("SELECT id FROM card_edit_history")).toEqual([]);
	});
	it("rolls back recording if the content update fails", () => {
		ctx.db.run(
			"CREATE TRIGGER fail_content BEFORE UPDATE ON notes BEGIN SELECT RAISE(ABORT, 'write failed'); END",
		);
		expect(() => ctx.cards.updateCardContent("card", "Lost", "Answer")).toThrow(
			"write failed",
		);
		expect(ctx.db.query("SELECT id FROM card_edit_history")).toEqual([]);
	});
	it("records system restoration without altering author counters or FSRS", () => {
		const scheduling = ctx.db.get(
			"SELECT due,stability,difficulty,reps,lapses,state FROM cards WHERE id='card'",
		);
		ctx.cards.updateCardContent("card", "After", "Answer", "ai");
		ctx.cards.updateCardContent("card", "Before", "Answer", "system");
		ctx.cards.updateCardContent("card", "After", "Answer", "system");
		expect(ctx.cards.get("card")).toMatchObject({
			editCount: 0,
			aiEditCount: 1,
		});
		expect(
			ctx.db.query("SELECT source FROM card_edit_history ORDER BY sequence"),
		).toEqual([{ source: "ai" }, { source: "system" }, { source: "system" }]);
		expect(
			ctx.db.get(
				"SELECT due,stability,difficulty,reps,lapses,state FROM cards WHERE id='card'",
			),
		).toEqual(scheduling);
	});
	it("excludes remote replacement, field-key migration and metadata-only writes", () => {
		const noteId = ctx.cards.get("card")!.noteId!;
		ctx.notes.update(noteId, { tags: ["changed"] });
		ctx.notes.renameFieldKey("builtin-basic", "Front", "Question");
		const remote = ctx.notes.getRawRowsByIds([noteId])[0]!;
		ctx.notes.upsertRowFromRemote({
			...remote,
			fields_json: '{"Front":"Remote","Back":"Answer"}',
			updated_at: Date.now() + 1,
		});
		expect(ctx.db.query("SELECT id FROM card_edit_history")).toEqual([]);
	});
	it("reads a reversed sibling in its own historical orientation", () => {
		const noteId = ctx.cards.get("card")!.noteId!;
		ctx.notes.update(noteId, { noteTypeId: "builtin-basic-reversed" });
		ctx.cards.set("reverse", {
			...createTestCard({ id: "reverse" }),
			noteId,
			templateOrd: 1,
			cardType: "reversed",
		});
		ctx.cards.updateCardContent("reverse", "New Back", "New Front");
		const history = new CardEditHistoryActions(ctx.db as never);
		expect(history.list().total).toBe(1);
		expect(history.forCard("reverse").events[0]!.cards[0]).toMatchObject({
			before: { question: "Answer", answer: "Before" },
			after: { question: "New Back", answer: "New Front" },
		});
		expect(history.forCard("card").events[0]!.cards[0]).toMatchObject({
			after: { question: "New Front", answer: "New Back" },
		});
		expect(history.forCard("card").siblingCardIds).toEqual(["card", "reverse"]);
	});
	it("renders shared cloze history using each cloze index", () => {
		ctx.notes.create({
			id: "cloze-note",
			noteTypeId: "builtin-cloze",
			fields: { Text: "{{c1::Paris}} is in {{c2::France}}", Extra: "Extra" },
			tags: [],
		});
		for (const index of [1, 2])
			ctx.cards.set(`cloze-${index}`, {
				...createTestCard({ id: `cloze-${index}` }),
				noteId: "cloze-note",
				cardType: "cloze",
				clozeIndex: index,
			});
		const before = ctx.cards.get("cloze-2")!;
		ctx.cards.updateClozeCardContent(
			"cloze-1",
			"",
			"",
			"{{c1::Berlin}} is in {{c2::Germany}}",
			"ai",
		);
		const after = ctx.cards.get("cloze-2")!;
		const history = new CardEditHistoryActions(ctx.db as never);
		expect(history.forCard("cloze-2").events[0]!.cards[0]).toMatchObject({
			before: { question: before.question, answer: before.answer },
			after: { question: after.question, answer: after.answer },
		});
		expect(history.list().total).toBe(1);
	});
	it("keeps saved custom templates when the current type is later changed", () => {
		ctx.noteTypes.create({
			id: "custom",
			name: "Custom",
			type: 0,
			fields: ["Front", "Back"],
			templates: [
				{
					name: "Card",
					ordinal: 0,
					qfmt: "Old {{Front}}",
					afmt: "Old {{Back}}",
				},
			],
			css: "",
			isBuiltin: false,
		});
		const noteId = ctx.cards.get("card")!.noteId!;
		ctx.notes.update(noteId, { noteTypeId: "custom" });
		ctx.notes.update(noteId, { fields: { Front: "After", Back: "Answer" } });
		ctx.noteTypes.update("custom", {
			templates: [
				{
					name: "Card",
					ordinal: 0,
					qfmt: "New {{Front}}",
					afmt: "New {{Back}}",
				},
			],
		});
		const page = new CardEditHistoryActions(ctx.db as never).forCard("card");
		expect(page.current.question).toBe("New After");
		expect(page.events[0]!.cards[0]).toMatchObject({
			before: { question: "Old Before" },
			after: { question: "Old After" },
		});
	});
	it("enforces age on reads without writes and preserves inclusive/exclusive date bounds", () => {
		const noteId = ctx.cards.get("card")!.noteId!;
		ctx.notes.update(noteId, { sourceUid: "source" });
		const start = Date.now();
		ctx.cards.updateCardContent("card", "Manual", "Answer");
		vi.setSystemTime(start + 1);
		ctx.cards.updateCardContent("card", "AI", "Answer", "ai");
		vi.setSystemTime(start + 2);
		ctx.cards.updateCardContent("card", "Restore", "Answer", "system");
		const history = new CardEditHistoryActions(ctx.db as never);
		expect(
			history.list({ since: start, until: start + 2, sourceUid: "source" }),
		).toMatchObject({ total: 2, count: 2 });
		expect(history.list({ editSource: "ai", offset: 1 })).toMatchObject({
			total: 1,
			count: 0,
			hasMore: false,
		});
		expect(history.list({ sourceUid: "none" }).total).toBe(0);
		vi.setSystemTime(start + 90 * 24 * 60 * 60 * 1000 + 2);
		expect(history.list().total).toBe(1);
		vi.setSystemTime(start + 91 * 24 * 60 * 60 * 1000);
		expect(history.forCard("card").total).toBe(0);
		expect(
			ctx.db.get<{ cnt: number }>("SELECT COUNT(*) cnt FROM card_edit_history")
				?.cnt,
		).toBe(3);
	});
	it("reads events with historical Q/A separately from latest current Q/A", () => {
		ctx.cards.updateCardContent("card", "Manual", "Answer");
		ctx.cards.updateCardContent("card", "AI", "Answer", "ai");
		const history = new CardEditHistoryActions(ctx.db as never);
		const page = history.forCard("card", { limit: 1 });
		expect(page).toMatchObject({
			total: 2,
			count: 1,
			hasMore: true,
			sharedNoteHistory: true,
			current: { question: "AI" },
			retention: { perNote: 50, global: 10000, maxAgeDays: 90 },
		});
		expect(page.events[0]).toMatchObject({
			source: "ai",
			fieldsBefore: { Front: "Manual" },
			fieldsAfter: { Front: "AI" },
			cards: [
				{
					id: "card",
					before: { question: "Manual", answer: "Answer" },
					after: { question: "AI", answer: "Answer" },
				},
			],
		});
		expect(history.list({ editSource: "manual" }).events[0]!.source).toBe(
			"manual",
		);
	});
	it("enforces the global cap and 90-day age when appending", () => {
		ctx.cards.updateCardContent("card", "seed", "Answer");
		ctx.db.run(
			`WITH RECURSIVE nums(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM nums WHERE x<10005)
   INSERT INTO card_edit_history(id,note_id,edited_at,source,before_fields_json,after_fields_json,before_note_type_json,after_note_type_json)
   SELECT 'seed-'||x, 'owner-'||x, ?, 'manual','{}','{}','{}','{}' FROM nums`,
			[Date.now()],
		);
		ctx.cards.updateCardContent("card", "cap", "Answer");
		expect(
			ctx.db.get<{ cnt: number }>("SELECT COUNT(*) cnt FROM card_edit_history")
				?.cnt,
		).toBe(10000);
		vi.setSystemTime(new Date("2027-01-09T10:00:00Z"));
		ctx.cards.updateCardContent("card", "aged", "Answer");
		expect(
			ctx.db.get<{ cnt: number }>("SELECT COUNT(*) cnt FROM card_edit_history")
				?.cnt,
		).toBe(1);
	});
	it("retains newest 50 edits per owner with deterministic equal-time order", () => {
		for (let i = 0; i < 55; i++)
			ctx.cards.updateCardContent("card", `Version ${i}`, "Answer");
		const rows = ctx.db.query<{ after_fields_json: string }>(
			"SELECT after_fields_json FROM card_edit_history ORDER BY sequence",
		);
		expect(rows).toHaveLength(50);
		expect(JSON.parse(rows[0]!.after_fields_json).Front).toBe("Version 5");
	});
	it("does not record or count unchanged fields even with reordered keys", () => {
		const noteId = ctx.cards.get("card")!.noteId!;
		ctx.notes.update(
			noteId,
			{ fields: { Back: "Answer", Front: "Before" } },
			"ai",
		);
		expect(ctx.db.query("SELECT id FROM card_edit_history")).toEqual([]);
		expect(ctx.notes.getById(noteId)).toMatchObject({
			editCount: 0,
			aiEditCount: 0,
		});
	});
	it("records AI note writes once for their shared content owner", () => {
		const noteId = ctx.cards.get("card")!.noteId!;
		ctx.notes.update(noteId, { fields: { Front: "AI", Back: "Answer" } }, "ai");
		expect(ctx.db.query("SELECT source FROM card_edit_history")).toEqual([
			{ source: "ai" },
		]);
		expect(ctx.notes.getById(noteId)).toMatchObject({
			editCount: 0,
			aiEditCount: 1,
		});
	});
	it("stores the actual before and after of a manual card edit", () => {
		ctx.cards.updateCardContent("card", "After", "Answer");
		const rows = ctx.db.query<Record<string, unknown>>(
			"SELECT * FROM card_edit_history",
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			source: "manual",
			edited_at: Date.now(),
			before_fields_json: '{"Front":"Before","Back":"Answer"}',
			after_fields_json: '{"Front":"After","Back":"Answer"}',
		});
		expect(ctx.cards.get("card")?.editCount).toBe(1);
	});
});
