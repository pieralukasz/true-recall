import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateParams } from "../cli-args.js";
import { TrueRecallClient } from "../client.js";
import { cardTools } from "../tools/card-tools.js";
import { createMockEditedCard, type EditedCard } from "./mocks/edited-cards.js";

type SqlValue = string | number | null;
type Database = {
	run(sql: string, params?: SqlValue[]): unknown;
	exec(sql: string): Array<{ columns: string[]; values: SqlValue[][] }>;
	close(): void;
};
// sql.js has no bundled declarations; keep its test-only boundary local.
const initSqlJs: () => Promise<{ Database: new () => Database }> =
	createRequire(import.meta.url)("sql.js");

let db: Database;
let client: TrueRecallClient;
const rendered = new Map<string, EditedCard>();

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	db.run(`CREATE TABLE notes (id TEXT, source_uid TEXT, deleted_at INTEGER,
		edit_count INTEGER, ai_edit_count INTEGER, content_edited_at INTEGER);
		CREATE TABLE cards (id TEXT, note_id TEXT, deleted_at INTEGER, suspended INTEGER)`);
	client = new TrueRecallClient(1);
	rendered.clear();
	vi.spyOn(client, "post").mockImplementation(async (path, body) => {
		expect(path).toBe("/query");
		const sql = (body as { sql: string }).sql;
		expect(sql.trim()).toMatch(/^SELECT\b/i);
		expect(sql).not.toContain(";");
		const result = db.exec(sql)[0];
		return {
			columns: result?.columns ?? [],
			rows:
				result?.values.map((values) =>
					Object.fromEntries(
						result.columns.map((column, i) => [column, values[i]]),
					),
				) ?? [],
		};
	});
	vi.spyOn(client, "get").mockImplementation(async (path) => {
		const card = rendered.get(decodeURIComponent(path.slice("/cards/".length)));
		if (!card) throw new Error("Card not found");
		return { ...card, reviewHistory: ["omitted"], sourceText: "omitted" };
	});
});

afterEach(() => {
	db.close();
	vi.restoreAllMocks();
});

function seed(
	card = createMockEditedCard(),
	options: {
		cardDeleted?: boolean;
		noteDeleted?: boolean;
		suspended?: boolean;
	} = {},
) {
	db.run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)", [
		card.id,
		card.sourceUid,
		options.noteDeleted ? 1 : null,
		card.editCount,
		card.aiEditCount,
		card.contentEditedAt,
	]);
	db.run("INSERT INTO cards VALUES (?, ?, ?, ?)", [
		card.id,
		card.id,
		options.cardDeleted ? 1 : null,
		options.suspended ? 1 : 0,
	]);
	rendered.set(card.id, card);
}

async function list(params: Record<string, unknown> = {}) {
	const tool = cardTools.find((tool) => tool.name === "list_edited_cards");
	expect(tool, "list_edited_cards must be registered").toBeDefined();
	if (!tool) throw new Error("Missing list_edited_cards");
	const result = await tool.handle(
		validateParams(tool.inputSchema, params),
		client,
	);
	return JSON.parse(result.content[0].text);
}

describe("list_edited_cards", () => {
	it.each([
		[false, ["ai-only", "both"]],
		[true, ["both"]],
	])("ai_only filters lifetime AI edits; manual_only=%s", async (manual_only, ids) => {
		seed(createMockEditedCard({ id: "ai-only", editCount: 0, aiEditCount: 2 }));
		seed(createMockEditedCard({ id: "both", editCount: 1, aiEditCount: 2 }));
		seed(
			createMockEditedCard({ id: "manual-only", editCount: 1, aiEditCount: 0 }),
		);
		seed(
			createMockEditedCard({
				id: "old-ai",
				editCount: 0,
				aiEditCount: 3,
				contentEditedAt: Date.parse("2026-10-01T10:00Z"),
			}),
		);
		const result = await list({
			ai_only: true,
			manual_only,
			since: "2026-10-10T00:00:00Z",
			until: "2026-10-11T00:00:00Z",
		});
		expect(result.cards.map((c: EditedCard) => c.id)).toEqual(ids);
		expect(
			result.cards.every(
				(c: EditedCard & { aiEdited: boolean }) =>
					c.aiEdited && c.aiEditCount > 0,
			),
		).toBe(true);
		expect(result.limitation).toContain("AI-edit-in-window");
	});

	it("manual_only means lifetime manual edits plus last ANY content edit in the window", async () => {
		seed(
			createMockEditedCard({
				id: "manual-then-ai",
				editCount: 1,
				aiEditCount: 4,
			}),
		);
		seed(createMockEditedCard({ id: "ai-only", editCount: 0, aiEditCount: 2 }));
		seed(
			createMockEditedCard({
				id: "old-manual",
				contentEditedAt: Date.parse("2026-10-01T10:00Z"),
			}),
		);
		const params = {
			since: "2026-10-10T00:00:00Z",
			until: "2026-10-11T00:00:00Z",
		};
		const all = await list(params);
		expect(all.cards.map((c: EditedCard) => c.id)).toEqual([
			"ai-only",
			"manual-then-ai",
		]);
		expect(all.cards[0].manuallyEdited).toBe(false);
		const result = await list({ ...params, manual_only: true });
		expect(result.cards.map((c: EditedCard) => c.id)).toEqual([
			"manual-then-ai",
		]);
		expect(result.limitation).toMatch(/manual-edit-in-window/);
	});

	it.each([
		["ordinary UID", "note-uid"],
		["apostrophe", "O'Brien"],
		["SQL-looking UID", "x'; DROP TABLE notes; --"],
		["Unicode UID", "źródło"],
	])("filters source_uid safely: %s", async (_description, sourceUid) => {
		seed(createMockEditedCard({ id: "matching", sourceUid }));
		seed(createMockEditedCard({ id: "other", sourceUid: "other" }));
		expect(
			(await list({ source_uid: sourceUid })).cards.map(
				(c: EditedCard) => c.id,
			),
		).toEqual(["matching"]);
		expect(db.exec("SELECT COUNT(*) FROM notes")[0].values[0][0]).toBe(2);
	});

	it("paginates deterministically by last edit descending then card ID", async () => {
		for (const id of ["b", "a", "c"]) seed(createMockEditedCard({ id }));
		seed(
			createMockEditedCard({
				id: "newer",
				contentEditedAt: Date.parse("2026-10-11T10:00Z"),
			}),
		);
		const first = await list({ limit: 2 });
		expect(first).toMatchObject({
			total: 4,
			count: 2,
			offset: 0,
			hasMore: true,
		});
		expect(first.cards.map((c: EditedCard) => c.id)).toEqual(["newer", "a"]);
		const last = await list({ limit: 2, offset: 2 });
		expect(last).toMatchObject({
			total: 4,
			count: 2,
			offset: 2,
			hasMore: false,
		});
		expect(last.cards.map((c: EditedCard) => c.id)).toEqual(["b", "c"]);
	});

	it("preserves total on an empty page beyond the end", async () => {
		seed();
		expect(await list({ offset: 9 })).toMatchObject({
			total: 1,
			count: 0,
			offset: 9,
			hasMore: false,
			cards: [],
		});
		expect(client.get).not.toHaveBeenCalled();
	});

	it("returns an empty result when there are no matches", async () => {
		expect(await list()).toMatchObject({
			total: 0,
			count: 0,
			offset: 0,
			hasMore: false,
			cards: [],
		});
		expect(client.get).not.toHaveBeenCalled();
	});

	it("excludes deleted cards and notes but includes suspended and archived-source cards", async () => {
		seed(createMockEditedCard({ id: "deleted-card" }), { cardDeleted: true });
		seed(createMockEditedCard({ id: "deleted-note" }), { noteDeleted: true });
		seed(
			createMockEditedCard({ id: "suspended", sourceUid: "archived-source" }),
			{ suspended: true },
		);
		expect((await list()).cards.map((c: EditedCard) => c.id)).toEqual([
			"suspended",
		]);
	});

	it.each([
		["zero limit", { limit: 0 }],
		["oversized limit", { limit: 201 }],
		["fractional limit", { limit: 1.5 }],
		["negative offset", { offset: -1 }],
		["fractional offset", { offset: 1.5 }],
		["unsafe offset", { offset: Number.MAX_SAFE_INTEGER + 1 }],
	])("rejects %s before SQL", async (_description, params) => {
		await expect(list(params)).rejects.toThrow();
		expect(client.post).not.toHaveBeenCalled();
	});

	it.each([
		["reversed", "Answer on front", "Question on back"],
		["cloze", "Paris is in [...]", "France"],
	])("uses get_card rendered text for %s rather than raw note fields", async (cardType, question, answer) => {
		const card = createMockEditedCard({
			id: "a/b c",
			cardType,
			question,
			answer,
		});
		seed(card);
		expect((await list()).cards[0]).toEqual({
			...card,
			edited: true,
			manuallyEdited: true,
			aiEdited: card.aiEditCount > 0,
		});
		expect(client.get).toHaveBeenCalledWith("/cards/a%2Fb%20c");
	});

	it("fails the entire result on a card lookup error", async () => {
		seed(createMockEditedCard({ id: "a" }));
		seed(createMockEditedCard({ id: "b" }));
		rendered.delete("b");
		await expect(list()).rejects.toThrow("Card not found");
	});

	it("propagates SQL failures without fallback or writes", async () => {
		vi.mocked(client.post).mockRejectedValue(new Error("SQL disabled"));
		await expect(list()).rejects.toThrow("SQL disabled");
		expect(client.post).toHaveBeenCalledTimes(1);
		expect(client.get).not.toHaveBeenCalled();
	});
	it("uses inclusive since and exclusive until with explicit timezones", async () => {
		const since = "2026-10-10T12:00:00+02:00";
		const until = "2026-10-10T13:00:00+02:00";
		for (const [id, time] of [
			["before", "09:59:59"],
			["start", "10:00:00"],
			["inside", "10:59:59"],
			["end", "11:00:00"],
		]) {
			seed(
				createMockEditedCard({
					id,
					contentEditedAt: Date.parse(`2026-10-10T${time}Z`),
				}),
			);
		}
		const result = await list({ since, until });
		expect(result.total).toBe(2);
		expect(result.cards.map((c: EditedCard) => c.id)).toEqual([
			"inside",
			"start",
		]);
	});

	it("interprets date-only boundaries as local midnight", async () => {
		const midnight = new Date(2026, 9, 10).getTime();
		seed(createMockEditedCard({ id: "before", contentEditedAt: midnight - 1 }));
		seed(createMockEditedCard({ id: "start", contentEditedAt: midnight }));
		seed(
			createMockEditedCard({
				id: "end",
				contentEditedAt: new Date(2026, 9, 11).getTime(),
			}),
		);
		expect(
			(await list({ since: "2026-10-10", until: "2026-10-11" })).cards.map(
				(c: EditedCard) => c.id,
			),
		).toEqual(["start"]);
	});

	it.each([
		["calendar overflow", "2026-02-30"],
		["non-leap day", "2025-02-29"],
		["invalid month", "2026-13-01"],
		["invalid day", "2026-01-00"],
		["no timezone", "2026-10-10T10:00:00"],
		["invalid time", "2026-10-10T24:00:00Z"],
		["datetime overflow", "2026-02-30T10:00:00Z"],
		["bad offset", "2026-10-10T10:00:00+24:00"],
		["SQL injection", "2026-10-10' OR 1=1"],
		["whitespace", " 2026-10-10"],
	])("rejects %s before SQL", async (_description, since) => {
		await expect(list({ since })).rejects.toThrow(/date|timezone|YYYY/i);
		await expect(list({ until: since })).rejects.toThrow(/date|timezone|YYYY/i);
		expect(client.post).not.toHaveBeenCalled();
	});

	it.each([
		["equal", "2026-10-10"],
		["earlier", "2026-10-09"],
	])("rejects %s until before SQL", async (_description, until) => {
		await expect(list({ since: "2026-10-10", until })).rejects.toThrow(
			/until.*since/i,
		);
		expect(client.post).not.toHaveBeenCalled();
	});

	it("accepts leap days and timezone ISO minutes", async () => {
		seed(
			createMockEditedCard({
				contentEditedAt: Date.parse("2024-02-29T10:00:00Z"),
			}),
		);
		expect(
			(
				await list({
					since: "2024-02-29T10:00Z",
					until: "2024-02-29T10:00:00.001Z",
				})
			).total,
		).toBe(1);
	});
	it("defaults to the first 50 edited cards with current rendered text and lifetime counters", async () => {
		const card = createMockEditedCard();
		seed(card);
		seed(
			createMockEditedCard({
				id: "unedited",
				editCount: 0,
				contentEditedAt: null,
			}),
		);
		const result = await list();
		expect(result).toMatchObject({
			total: 1,
			count: 1,
			offset: 0,
			hasMore: false,
		});
		expect(result.cards).toEqual([
			{
				...card,
				edited: true,
				manuallyEdited: true,
				aiEdited: card.aiEditCount > 0,
			},
		]);
		expect(result.limitation).toMatch(/lifetime/i);
		expect(result.limitation).toMatch(/shared/i);
		expect(client.post).toHaveBeenCalledTimes(1);
		expect(client.post).toHaveBeenCalledWith(
			"/query",
			expect.objectContaining({
				sql: expect.stringContaining("LIMIT 50 OFFSET 0"),
			}),
		);
	});
});
