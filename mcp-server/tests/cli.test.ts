import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SERVER_VERSION } from "../server.js";
import { FakeLocalApi } from "./fake-local-api.js";

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
