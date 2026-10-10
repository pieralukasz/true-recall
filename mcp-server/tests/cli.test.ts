import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SERVER_VERSION } from "../server.js";
import { FakeLocalApi } from "./fake-local-api.js";
import { createMockEditedCard } from "./mocks/edited-cards.js";

const CLI = resolve(import.meta.dirname, "../../cli/index.ts");
const api = new FakeLocalApi();

beforeAll(() => api.start());
afterAll(() => api.stop());

type Run = { code: number; stdout: string; stderr: string };

/** Async on purpose: a sync spawn would block the fake API in this process. */
function run(...args: string[]): Promise<Run> {
	return new Promise((done) => {
		execFile(
			"bun",
			[CLI, ...args],
			{
				env: {
					...process.env,
					TRUE_RECALL_PORT: String(api.port),
					TRUE_RECALL_TOKEN: "t0k",
				},
			},
			(error, stdout, stderr) => {
				const code = error ? Number((error as { code?: number }).code ?? 1) : 0;
				done({ code, stdout: stdout.trim(), stderr: stderr.trim() });
			},
		);
	});
}

describe("true-recall CLI", () => {
	it("reads persistent edit events through the dedicated read-only command", async () => {
		api.reply("GET /card-edits", {
			body: {
				ok: true,
				data: {
					total: 1,
					count: 1,
					events: [
						{
							source: "ai",
							fieldsBefore: { Front: "Old" },
							fieldsAfter: { Front: "New" },
						},
					],
				},
			},
		});
		const r = await run(
			"list_card_edits",
			"--edit-source",
			"ai",
			"--since",
			"2026-10-10",
			"--limit",
			"1",
		);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toMatchObject({
			total: 1,
			events: [{ source: "ai" }],
		});
		const help = await run("get_card_edit_history", "--help");
		expect(help.code).toBe(0);
		expect(help.stdout).toContain("read-only");
		expect(help.stdout).toContain("--card-id");
	});
	it("prints edited-card current text, counters and pagination from the shared tool", async () => {
		const card = createMockEditedCard();
		api.reply("POST /query", {
			body: {
				ok: true,
				data: { columns: ["total", "id"], rows: [{ total: 3, id: card.id }] },
			},
		});
		api.reply(`GET /cards/${card.id}`, { body: { ok: true, data: card } });
		const r = await run(
			"list_edited_cards",
			"--since",
			"2026-10-10",
			"--until",
			"2026-10-17",
			"--manual-only",
			"--limit",
			"1",
			"--offset",
			"1",
		);
		expect(r.code).toBe(0);
		const result = JSON.parse(r.stdout);
		expect(result).toMatchObject({
			total: 3,
			count: 1,
			offset: 1,
			hasMore: true,
		});
		expect(result.cards).toEqual([
			{
				...card,
				edited: true,
				manuallyEdited: true,
				aiEdited: card.aiEditCount > 0,
			},
		]);
	});

	it("shows edited-card read-only help, defaults and limitations", async () => {
		const r = await run("list_edited_cards", "--help");
		expect(r.code).toBe(0);
		for (const text of [
			"[read-only]",
			"--since <string>",
			"--until <string>",
			"--manual-only <boolean> (default false)",
			"--ai-only <boolean> (default false)",
			"not the last AI edit",
			"--limit <number> (default 50)",
			"--offset <number> (default 0)",
			"lifetime",
			"shared",
			"archived",
			"Enable SQL query endpoint",
			"not the last manual edit",
		]) {
			expect(r.stdout).toContain(text);
		}
	});

	it.each([
		["calendar overflow", ["--since", "2026-02-30"]],
		["missing timezone", ["--since", "2026-10-10T10:00:00"]],
		["equal bounds", ["--since", "2026-10-10", "--until", "2026-10-10"]],
		["negative offset", ["--offset", "-1"]],
	])("exits 2 for %s without HTTP requests", async (_description, args) => {
		const before = api.requests.length;
		const r = await run("list_edited_cards", ...args);
		expect(r.code, args.join(" ")).toBe(2);
		expect(JSON.parse(r.stderr).hint).toContain("list_edited_cards --help");
		expect(api.requests.length).toBe(before);
	});

	it("reports disabled SQL without auto-enabling it", async () => {
		api.reply("POST /query", {
			status: 403,
			body: {
				ok: false,
				error: "SQL query endpoint is disabled",
				code: "sql-query-disabled",
			},
		});
		const before = api.requests.length;
		const r = await run("list_edited_cards");
		expect(r.code).toBe(1);
		expect(JSON.parse(r.stderr)).toMatchObject({
			status: 403,
			code: "sql-query-disabled",
		});
		expect(r.stderr).toContain("Enable SQL query endpoint");
		expect(api.requests.slice(before).map((r) => r.path)).toEqual(["/query"]);
	});
	it("prints the version", async () => {
		expect(await run("--version")).toMatchObject({
			code: 0,
			stdout: SERVER_VERSION,
		});
	});

	it("prints compact JSON when stdout is not a terminal", async () => {
		const r = await run("get_status");
		expect(r).toMatchObject({ code: 0, stdout: '{"route":"GET /status"}' });
		expect(api.last()?.authorization).toBe("Bearer t0k");
	});

	it("indents with --pretty", async () => {
		expect((await run("get_status", "--pretty")).stdout).toContain(
			'\n  "route"',
		);
	});

	it("accepts dashed flags, null and comma lists", async () => {
		expect((await run("set_note_preset", "--preset-name", "null")).code).toBe(
			0,
		);
		expect(api.last()?.body).toEqual({ preset_name: null });

		expect(
			(await run("bulk_suspend_cards", "--card_ids", "a,b", "--suspended"))
				.code,
		).toBe(0);
		expect(api.last()?.body).toEqual({ card_ids: ["a", "b"], suspended: true });
	});

	it("takes parameters as one JSON object", async () => {
		const cards = [{ question: "Q", answer: "A" }];
		expect(
			(
				await run(
					"create_flashcards_batch",
					"--json",
					JSON.stringify({ cards }),
				)
			).code,
		).toBe(0);
		expect(api.last()).toMatchObject({
			method: "POST",
			path: "/cards",
			body: { cards },
		});
	});

	it("exits 2 with a hint on bad usage, without calling the API", async () => {
		const before = api.requests.length;
		for (const args of [
			["list_cards", "--limit", "999"],
			["list_cards", "--nope", "1"],
			["no_such_command"],
		]) {
			const r = await run(...args);
			expect(r.code, args.join(" ")).toBe(2);
			expect(JSON.parse(r.stderr).hint).toMatch(/--help/);
		}
		expect(api.requests.length).toBe(before);
	});

	it("exits 1 with status, code and hint on API errors", async () => {
		api.reply("GET /status", {
			status: 401,
			body: {
				ok: false,
				error: "Local API authentication is required",
				code: "unauthorized",
			},
		});
		const r = await run("get_status");
		api.reply("GET /status", {
			body: { ok: true, data: { route: "GET /status" } },
		});
		expect(r.code).toBe(1);
		expect(JSON.parse(r.stderr)).toMatchObject({
			status: 401,
			code: "unauthorized",
		});
		expect(r.stderr).toContain("TRUE_RECALL_TOKEN");
	});

	it("shows parameters, types and the write label in command help", async () => {
		const r = await run("delete_card", "--help");
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("[destructive]");
		expect(r.stdout).toContain("--card-id <string> (required)");
	});
});
