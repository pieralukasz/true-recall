import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { requestUrl } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import type { NoteType } from "@true-recall/core/types/note.types";

import type {
	ApiContext,
	ApiRequest,
	ApiResponseWriter,
} from "@true-recall/obsidian/plugin/api/api.types";
import { dispatch } from "@true-recall/obsidian/plugin/api/routes";

import { LocalApiError, TrueRecallClient } from "../../../../mcp-server/client";

const API_TOKEN = "e2e-local-api-secret";
const TRUSTED_ORIGIN = "chrome-extension://trusted";
const requestUrlMock = requestUrl as unknown as ReturnType<typeof vi.fn>;

const basicNoteType: NoteType = {
	id: "builtin-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

function createContext(
	apiEnableSqlQuery: boolean,
	createNoteBatch: ReturnType<typeof vi.fn>,
): ApiContext {
	return {
		apiToken: API_TOKEN,
		plugin: {
			settings: {
				...DEFAULT_SETTINGS,
				providerType: "pro",
				proKey: "pro-key",
				apiAllowedOrigins: [TRUSTED_ORIGIN],
				apiEnableSqlQuery,
			},
			isStoreReady: () => true,
			app: {
				vault: { getName: () => "E2E Vault" },
				workspace: { getActiveFile: () => null },
			},
			flashcardManager: {
				getNoteTypeBySlug: (slug: string) =>
					slug === basicNoteType.slug ? basicNoteType : null,
				createNoteBatch,
			},
		} as unknown as ApiContext["plugin"],
	};
}

async function listen(server: Server): Promise<number> {
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});
	return (server.address() as AddressInfo).port;
}

describe("Local API → shared CLI/MCP client", () => {
	let server: Server;
	let port: number;
	let previousToken: string | undefined;
	let apiEnableSqlQuery: boolean;
	let createNoteBatch: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		previousToken = process.env.TRUE_RECALL_TOKEN;
		apiEnableSqlQuery = false;
		requestUrlMock.mockReset();
		createNoteBatch = vi.fn((notes: Array<Record<string, unknown>>) => ({
			cards: notes.map((note, index) => ({
				id: `generated-${index + 1}`,
				question: (note.fields as Record<string, string>).Front,
				answer: (note.fields as Record<string, string>).Back,
				cardType: "basic",
				sourceText: note.sourceText,
			})),
		}));
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		server = createServer((req, res) => {
			void dispatch(
				req as unknown as ApiRequest,
				res as unknown as ApiResponseWriter,
				createContext(apiEnableSqlQuery, createNoteBatch),
			).catch((error) => {
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: false, error: String(error) }));
			});
		});
		port = await listen(server);
	});

	afterEach(async () => {
		if (previousToken === undefined) delete process.env.TRUE_RECALL_TOKEN;
		else process.env.TRUE_RECALL_TOKEN = previousToken;
		vi.restoreAllMocks();
		if (!server.listening) return;
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});

	it("authenticates the shared client and returns status through the full HTTP stack", async () => {
		process.env.TRUE_RECALL_TOKEN = API_TOKEN;
		const client = new TrueRecallClient(port);

		await expect(client.get("/status")).resolves.toEqual({
			running: true,
			dbReady: true,
			vault: "E2E Vault",
		});
	});

	it("returns a structured error with a correlation id when the token is missing", async () => {
		delete process.env.TRUE_RECALL_TOKEN;
		const client = new TrueRecallClient(port);

		await expect(client.get("/status")).rejects.toMatchObject({
			constructor: LocalApiError,
			status: 401,
			code: "unauthorized",
			retryable: false,
			requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
		});
	});

	it("keeps the authenticated SQL endpoint disabled by default", async () => {
		process.env.TRUE_RECALL_TOKEN = API_TOKEN;
		const client = new TrueRecallClient(port);

		await expect(
			client.post("/query", { sql: "SELECT 1" }),
		).rejects.toMatchObject({
			constructor: LocalApiError,
			status: 403,
			code: "sql-query-disabled",
			requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
		});
	});

	it("returns a structured 413 response when the request body is too large", async () => {
		process.env.TRUE_RECALL_TOKEN = API_TOKEN;
		apiEnableSqlQuery = true;
		const client = new TrueRecallClient(port);

		await expect(
			client.post("/query", { sql: `SELECT '${"x".repeat(2 * 1024 * 1024)}'` }),
		).rejects.toMatchObject({
			constructor: LocalApiError,
			status: 413,
			code: "payload-too-large",
			requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
		});
	});

	it("generates cards through the True Recall proxy transport", async () => {
		process.env.TRUE_RECALL_TOKEN = API_TOKEN;
		requestUrlMock.mockResolvedValue({
			status: 200,
			json: {
				id: "completion-1",
				choices: [
					{
						message: {
							role: "assistant",
							content: JSON.stringify([
								{
									type: "basic",
									Front: "What is FSRS?",
									Back: "A spaced-repetition scheduler.",
									source: "FSRS is a spaced-repetition scheduler.",
								},
							]),
						},
						finish_reason: "stop",
					},
				],
			},
			text: "",
		});
		const client = new TrueRecallClient(port);

		await expect(
			client.post("/generate", {
				text: "FSRS is a spaced-repetition scheduler.",
			}),
		).resolves.toEqual({
			created: 1,
			cards: [
				{
					id: "generated-1",
					question: "What is FSRS?",
					answer: "A spaced-repetition scheduler.",
					cardType: "basic",
					sourceText: "FSRS is a spaced-repetition scheduler.",
				},
			],
		});

		expect(createNoteBatch).toHaveBeenCalledOnce();
		expect(requestUrlMock).toHaveBeenCalledOnce();
		const upstreamRequest = requestUrlMock.mock.calls[0]?.[0] as {
			url: string;
			headers: Record<string, string>;
			body: string;
		};
		expect(upstreamRequest.url).toBe(
			"https://ai.truerecall.app/v1/chat/completions",
		);
		expect(upstreamRequest.headers.Authorization).toBe("Bearer pro-key");
		expect(JSON.parse(upstreamRequest.body)).toMatchObject({
			model: "auto",
			metadata: { call_context: "generation", note_type: "basic" },
		});
	});

	it("returns safe proxy errors with machine-readable metadata", async () => {
		process.env.TRUE_RECALL_TOKEN = API_TOKEN;
		requestUrlMock.mockResolvedValue({
			status: 503,
			json: {
				error: {
					code: "UPSTREAM_UNAVAILABLE",
					message: "litellm could not connect to 10.0.0.12",
					correlation_id: "proxy-correlation-123",
					retryable: true,
				},
			},
			text: "",
		});
		const client = new TrueRecallClient(port);

		const error = await client
			.post("/generate", { text: "Generate a card." })
			.catch((reason: unknown) => reason);

		expect(error).toMatchObject({
			constructor: LocalApiError,
			status: 503,
			code: "UPSTREAM_UNAVAILABLE",
			retryable: true,
			requestId: "proxy-correlation-123",
		});
		expect((error as Error).message).toBe(
			"The service is temporarily unavailable. Please try again.",
		);
		expect((error as Error).message).not.toContain("10.0.0.12");
		expect(createNoteBatch).not.toHaveBeenCalled();
	});

	it.each([
		[TRUSTED_ORIGIN, 200, TRUSTED_ORIGIN],
		["chrome-extension://untrusted", 403, null],
	] as const)("applies the browser origin allowlist for %s", async (origin, expectedStatus, expectedAllowOrigin) => {
		const response = await fetch(`http://127.0.0.1:${port}/status`, {
			headers: {
				Authorization: `Bearer ${API_TOKEN}`,
				Origin: origin,
			},
		});

		expect(response.status).toBe(expectedStatus);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			expectedAllowOrigin,
		);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
	});
});
