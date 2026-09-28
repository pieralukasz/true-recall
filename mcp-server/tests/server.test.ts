import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TrueRecallClient } from "../client.js";
import { ALL_TOOLS, createServer, SERVER_INSTRUCTIONS } from "../server.js";
import { TOOL_HINTS } from "../tools/_hints.js";
import { FakeLocalApi } from "./fake-local-api.js";

type TextResult = {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
};

const api = new FakeLocalApi();
let client: Client;

beforeAll(async () => {
	await api.start();
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await createServer(new TrueRecallClient(api.port)).connect(serverSide);
	client = new Client({ name: "test", version: "0" });
	await client.connect(clientSide);
});

afterAll(async () => {
	await client.close();
	await api.stop();
});

beforeEach(() => {
	api.requests.length = 0;
});

async function call(
	name: string,
	args: Record<string, unknown> = {},
): Promise<TextResult> {
	return (await client.callTool({ name, arguments: args })) as TextResult;
}

describe("tool list", () => {
	it("lists every tool with a title and annotations", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual(
			ALL_TOOLS.map((t) => t.name).sort(),
		);
		for (const tool of tools) {
			expect(tool.title, tool.name).toBeTruthy();
			expect(tool.annotations?.readOnlyHint, tool.name).toBeTypeOf("boolean");
			expect(tool.description?.length, tool.name).toBeGreaterThan(40);
		}
	});

	it("has no hint entries for tools that don't exist", () => {
		const names = new Set(ALL_TOOLS.map((t) => t.name));
		expect(Object.keys(TOOL_HINTS).filter((n) => !names.has(n))).toEqual([]);
	});

	it("marks the data-losing tools destructive", async () => {
		const { tools } = await client.listTools();
		const destructive = tools
			.filter((t) => t.annotations?.destructiveHint === true)
			.map((t) => t.name)
			.sort();
		expect(destructive).toEqual(
			[
				"bulk_delete_cards",
				"delete_card",
				"delete_card_polish_preset",
				"delete_generation_preset",
				"dissolve_project",
				"grade_card",
				"grade_review_card",
				"remove_cards_from_note",
				"toggle_note_review",
				"update_card",
				"update_card_polish_preset",
				"update_fsrs_preset",
				"update_generation_preset",
			].sort(),
		);
	});

	it("exposes the CLI-only tools over MCP too", async () => {
		const { tools } = await client.listTools();
		const names = new Set(tools.map((t) => t.name));
		for (const name of [
			"list_card_polish_presets",
			"create_card_polish_preset",
			"update_card_polish_preset",
			"delete_card_polish_preset",
			"export_csv",
			"optimize_parameters",
			"simulate_reviews",
			"get_workload_forecast",
			"get_retrievability",
			"get_scheduling_preview",
			"toggle_note_review",
			"note_review_status",
			"note_stats",
			"note_cards",
		]) {
			expect(names.has(name), name).toBe(true);
		}
	});

	it("sends server instructions with the answer-privacy rule", () => {
		expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
		expect(SERVER_INSTRUCTIONS).toContain("ANSWER PRIVACY");
	});

	it("does not advertise features the tools lack", async () => {
		const { tools } = await client.listTools();
		const byName = new Map(tools.map((t) => [t.name, t.description ?? ""]));
		expect(byName.get("list_cards")).not.toMatch(/sorting/i);
		expect(byName.get("get_study_recommendations")).not.toMatch(/AI-powered/);
		expect(byName.get("delete_card")).toMatch(/soft-deleted/);
	});
});

describe("HTTP calls", () => {
	it("sends a flat body to create_generation_preset", async () => {
		const preset = {
			name: "Exam",
			prompt: "Make cards",
			noteTypeId: "builtin-basic",
			requiresPro: false,
			isDefault: false,
		};
		await call("create_generation_preset", { preset });
		expect(api.last()).toMatchObject({
			method: "POST",
			path: "/generation-presets",
			body: preset,
		});
	});

	it("sends a real tab when export_csv separator is 'tab'", async () => {
		await call("export_csv", { separator: "tab" });
		expect(api.last()).toMatchObject({
			method: "POST",
			path: "/export/csv",
			body: { separator: "\t", include_scheduling: true },
		});
	});

	it("passes null preset_name to set_note_preset", async () => {
		await call("set_note_preset", { preset_name: null, path: "A.md" });
		expect(api.last()?.body).toEqual({ preset_name: null, path: "A.md" });
	});

	it("puts limit and filters in the get_due_cards query", async () => {
		await call("get_due_cards", { limit: 5 });
		expect(api.last()?.path).toBe("/cards/due?limit=5");
	});

	it("encodes ids in paths", async () => {
		await call("get_card", { card_id: "a/b c" });
		expect(api.last()?.path).toBe("/cards/a%2Fb%20c");
	});

	it("rejects arguments outside the schema before any HTTP call", async () => {
		const result = await call("list_cards", { limit: 500 });
		expect(result.isError).toBe(true);
		expect(api.requests).toHaveLength(0);
	});

	it("returns compact JSON", async () => {
		const result = await call("get_status");
		expect(result.content[0]?.text).toBe('{"route":"GET /status"}');
	});
});

describe("errors", () => {
	it("reports 401 with a token hint instead of swallowing it", async () => {
		api.reply("GET /status", {
			status: 401,
			body: {
				ok: false,
				error: "Local API authentication is required",
				code: "unauthorized",
			},
		});
		const result = await call("get_status");
		api.reply("GET /status", { body: { ok: true, data: { running: true } } });
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("HTTP 401");
		expect(result.content[0]?.text).toContain("TRUE_RECALL_TOKEN");
	});

	it("explains a disabled SQL endpoint", async () => {
		api.reply("POST /query", {
			status: 403,
			body: {
				ok: false,
				error: "SQL query endpoint is disabled",
				code: "sql-query-disabled",
			},
		});
		const result = await call("query_sql", { sql: "SELECT 1" });
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("Enable SQL query endpoint");
	});

	it("tells the user how to fix an unreachable plugin", async () => {
		const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
		await createServer(new TrueRecallClient(1)).connect(serverSide);
		const offline = new Client({ name: "offline", version: "0" });
		await offline.connect(clientSide);
		const result = (await offline.callTool({
			name: "get_status",
			arguments: {},
		})) as TextResult;
		await offline.close();
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toContain("Enable local API");
	});
});
