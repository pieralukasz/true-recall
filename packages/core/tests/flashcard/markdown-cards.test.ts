import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	parseMarkdownCards,
	serializeMarker,
	writeMarkers,
} from "../../src/flashcard/markdown/parser";
import {
	DEFAULT_MARKDOWN_FLASHCARDS as config,
	MarkdownFlashcardsSettingsSchema,
} from "../../src/flashcard/markdown/settings";
import {
	MarkdownCardSyncService,
	markdownCardId,
} from "../../src/flashcard/markdown/sync-service";
import {
	createTestContext,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";

const noteId = "b2ae1100-aaf1-4d7b-9e31-93345ca52922";
const otherId = "b2ae1100-aaf1-4d7b-9e31-93345ca52923";
const source = (
	id = noteId,
	separator = "??",
	question = "Capital of France?",
) =>
	`#flashcards\n\n${question}\n${separator}\nParis\n${serializeMarker({ v: 1, id })}\n`;

describe("Markdown card parsing", () => {
	it("ignores frontmatter and fenced examples while retaining multiline Markdown fields", () => {
		const text =
			"---\ntags: [flashcards]\nexample: ??\n---\n\n```md\nQ\n??\nA\n```\n\n**Question**\nsecond line\n??\n- Answer\n- More\n";
		const cards = parseMarkdownCards(text, config);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.front).toBe("**Question**\nsecond line");
		expect(cards[0]?.back).toBe("- Answer\n- More");
	});
	it("roundtrips CRLF text and persists distinct IDs without rewriting author content", () => {
		const input =
			"#flashcards\r\n\r\nQ1\r\n??\r\nA1\r\n\r\nQ2\r\n???\r\nA2\r\n";
		const cards = parseMarkdownCards(input, config);
		const output = writeMarkers(input, cards, (card) => ({
			v: 1,
			id: cards.indexOf(card) ? otherId : noteId,
		}));
		const parsed = parseMarkdownCards(output, config);
		expect(parsed.map((c) => [c.front, c.marker?.id, c.reversed])).toEqual([
			["Q1", noteId, false],
			["Q2", otherId, true],
		]);
		expect(output.replace(/\r\n<!-- true-recall:.*?-->/g, "")).toBe(input);
		expect(
			writeMarkers(output, parsed, (card) => ({
				v: 1,
				id: card.marker?.id ?? "",
			})),
		).toBe(output);
	});
	it("accepts custom separators literally", () => {
		expect(
			parseMarkdownCards("Q\n.*+\nA", { ...config, basicSeparator: ".*+" })[0]
				?.back,
		).toBe("A");
	});
	it.each([
		"Q\n??",
		"Q\n??\nA\nQ2\n??\nA2",
		"Q\n??\nA\n<!-- true-recall: garbage -->",
		`${source()}\n${source()}`,
		`Q\n??\nA\n${serializeMarker({ v: 1, id: noteId })}\nextra`,
		"```\nunfinished",
		"---\ntags: flashcards",
		`${serializeMarker({ v: 1, id: noteId })}`,
	])("rejects incomplete or ambiguous input without deleting existing cards: %s", (input) => {
		expect(() => parseMarkdownCards(input, config)).toThrow();
	});
	it("rejects identical separators and multiline settings", () => {
		expect(
			MarkdownFlashcardsSettingsSchema.safeParse({
				...config,
				reversedSeparator: "??",
			}).success,
		).toBe(false);
		expect(
			MarkdownFlashcardsSettingsSchema.safeParse({
				...config,
				basicSeparator: "a\nb",
			}).success,
		).toBe(false);
	});
});

describe("Markdown cards with real SQLite persistence", () => {
	let ctx: TestContext;
	let sync: MarkdownCardSyncService;
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-22T08:00:00Z"));
		ctx = await createTestContext();
		sync = new MarkdownCardSyncService({
			cards: ctx.cards,
			notes: ctx.notes,
			transaction: (fn) => ctx.db.transaction(fn),
		});
	});
	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});
	it("creates a reversed pair and preserves IDs and review progress after edits and reordering", () => {
		const input = `${source(noteId, "???")}\n${source(otherId)}`;
		sync.sync(parseMarkdownCards(input, config), "source-a", false);
		expect(ctx.cards.size()).toBe(3);
		const id = markdownCardId(noteId, 0);
		const card = ctx.cards.get(id);
		if (!card) throw new Error("Missing card");
		ctx.cards.set(id, {
			...card,
			reps: 12,
			stability: 30,
			due: "2026-10-22T08:00:00.000Z",
		});
		const edited = `${source(otherId)}\n${source(noteId, "???", "Edited question")}`;
		sync.sync(parseMarkdownCards(edited, config), "source-a", false);
		expect(ctx.cards.size()).toBe(3);
		expect(ctx.cards.get(id)).toMatchObject({
			question: "Edited question",
			reps: 12,
			stability: 30,
			due: "2026-10-22T08:00:00.000Z",
		});
		expect(
			sync.sync(parseMarkdownCards(edited, config), "source-a", false),
		).toEqual([]);
	});
	it("does not allow copied IDs to overwrite another source note", () => {
		sync.sync(parseMarkdownCards(source(), config), "source-a", false);
		expect(() =>
			sync.sync(
				parseMarkdownCards(source(noteId, "??", "Hijacked"), config),
				"source-b",
				false,
			),
		).toThrow("another note");
		expect(ctx.cards.get(markdownCardId(noteId, 0))?.question).toBe(
			"Capital of France?",
		);
	});
	it("removes only Markdown-owned cards when their block is removed", () => {
		sync.sync(parseMarkdownCards(source(), config), "source-a", false);
		const original = ctx.cards.get(markdownCardId(noteId, 0));
		if (!original) throw new Error("Missing original card");
		ctx.cards.set("manual", {
			...original,
			id: "manual",
			noteId: undefined,
			question: "Manual",
			createdVia: "manual",
		});
		sync.sync([], "source-a", false);
		expect(ctx.cards.get(markdownCardId(noteId, 0))).toBeUndefined();
		expect(ctx.cards.get("manual")?.question).toBe("Manual");
	});
	it("restores portable FSRS state in a fresh database and newer local progress wins", async () => {
		const cards = parseMarkdownCards(source(noteId, "???"), config);
		sync.sync(cards, "source-a", true);
		const id = markdownCardId(noteId, 0);
		const card = ctx.cards.get(id);
		if (!card) throw new Error("Missing card");
		ctx.cards.set(id, {
			...card,
			reps: 8,
			stability: 17,
			difficulty: 5.5,
			state: 2,
			scheduledDays: 15,
			suspended: true,
		});
		const snapshot = sync.snapshot({ v: 1, id: noteId }, true);
		const portable = parseMarkdownCards(
			writeMarkers(source(noteId, "???"), cards, () => snapshot),
			config,
		);
		const fresh = await createTestContext();
		try {
			const imported = new MarkdownCardSyncService({
				cards: fresh.cards,
				notes: fresh.notes,
				transaction: (fn) => fresh.db.transaction(fn),
			});
			imported.sync(portable, "source-b", true);
			expect(fresh.cards.get(id)).toMatchObject({
				reps: 8,
				stability: 17,
				difficulty: 5.5,
				state: 2,
				scheduledDays: 15,
				suspended: true,
			});
			vi.advanceTimersByTime(1000);
			const restored = fresh.cards.get(id);
			if (!restored) throw new Error("Missing restored card");
			fresh.cards.set(id, { ...restored, reps: 9, stability: 20 });
			imported.sync(portable, "source-b", true);
			expect(fresh.cards.get(id)).toMatchObject({ reps: 9, stability: 20 });
		} finally {
			fresh.close();
		}
	});
	it("restores a removed block and a reversed template without losing progress", () => {
		const cards = parseMarkdownCards(source(noteId, "???"), config);
		sync.sync(cards, "source-a", false);
		const id = markdownCardId(noteId, 1);
		const original = ctx.cards.get(id);
		if (!original) throw new Error("Missing reverse card");
		ctx.cards.set(id, { ...original, reps: 7 });
		sync.sync(parseMarkdownCards(source(), config), "source-a", false);
		expect(ctx.cards.get(id)).toBeUndefined();
		sync.sync(cards, "source-a", false);
		expect(ctx.cards.get(id)?.reps).toBe(7);
		sync.sync([], "source-a", false);
		expect(ctx.cards.size()).toBe(0);
		sync.sync(cards, "source-a", false);
		expect(ctx.cards.get(id)?.reps).toBe(7);
		expect(ctx.cards.size()).toBe(2);
	});
	it("reuses panel-generated reverse cards and retains their IDs when restored", () => {
		sync.sync(parseMarkdownCards(source(), config), "source-a", false);
		ctx.notes.update(noteId, { noteTypeId: "builtin-basic-reversed" });
		const original = ctx.cards.get(markdownCardId(noteId, 0));
		if (!original) throw new Error("Missing card");
		ctx.cards.set("panel-generated-reverse", {
			...original,
			id: "panel-generated-reverse",
			cardType: "reversed",
			templateOrd: 1,
			reps: 9,
		});
		const pair = parseMarkdownCards(source(noteId, "???"), config);
		sync.sync(pair, "source-a", false);
		expect(ctx.cards.size()).toBe(2);
		expect(sync.snapshot({ v: 1, id: noteId }, true).schedules?.[1]?.reps).toBe(
			9,
		);
		sync.sync(parseMarkdownCards(source(), config), "source-a", false);
		sync.sync(pair, "source-a", false);
		expect(ctx.cards.get("panel-generated-reverse")?.reps).toBe(9);
		expect(ctx.cards.size()).toBe(2);
	});

	it("ignores portable scheduling completely when storage is external", () => {
		const cards = parseMarkdownCards(source(), config);
		sync.sync(cards, "source-a", false);
		const snapshot = sync.snapshot({ v: 1, id: noteId }, false);
		const schedule = snapshot.schedules?.[0];
		if (!schedule) throw new Error("Missing schedule");
		schedule.reps = 99;
		schedule.updatedAt += 5000;
		const portable = parseMarkdownCards(
			writeMarkers(source(), cards, () => snapshot),
			config,
		);
		sync.sync(portable, "source-a", false);
		expect(ctx.cards.get(markdownCardId(noteId, 0))?.reps).toBe(0);
		sync.sync(portable, "source-a", true);
		expect(ctx.cards.get(markdownCardId(noteId, 0))?.reps).toBe(99);
	});
});
