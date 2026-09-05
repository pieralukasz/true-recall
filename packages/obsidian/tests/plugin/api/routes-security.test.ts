import { describe, expect, it } from "vitest";

import type {
	ApiContext,
	ApiRequest,
	ApiResponseWriter,
} from "@true-recall/obsidian/plugin/api/api.types";
import { LocalApiServer } from "@true-recall/obsidian/plugin/api/LocalApiServer";
import { dispatch } from "@true-recall/obsidian/plugin/api/routes";

function request(
	method: string,
	url: string,
	headers: ApiRequest["headers"] = {},
): ApiRequest {
	return {
		method,
		url,
		headers,
		on: () => {},
		destroy: () => {},
	};
}

function response(): ApiResponseWriter & {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
} {
	return {
		writeHead(status, headers) {
			this.status = status;
			this.headers = headers;
		},
		end(body) {
			this.body = body;
			this.writableEnded = true;
		},
	};
}

function context(allowedOrigins: string[] = []): ApiContext {
	return {
		apiToken: "secret-token",
		plugin: {
			settings: { apiAllowedOrigins: allowedOrigins },
		} as ApiContext["plugin"],
	};
}

describe("Local API security boundary", () => {
	it("creates one persistent installation token and reuses it after restart", () => {
		const localStorage = new Map<string, unknown>();
		const saveLocalStorage = (key: string, value: unknown) => {
			localStorage.set(key, value);
		};
		const plugin = {
			app: {
				loadLocalStorage: (key: string) => localStorage.get(key),
				saveLocalStorage,
			},
		} as unknown as ApiContext["plugin"];

		const firstToken = new LocalApiServer(plugin).getToken();
		const secondToken = new LocalApiServer(plugin).getToken();

		expect(firstToken).toMatch(/^[0-9a-f]{64}$/);
		expect(secondToken).toBe(firstToken);
		expect(localStorage.size).toBe(1);
	});

	it("requires authentication even for loopback requests", async () => {
		const res = response();
		await dispatch(request("GET", "/status"), res, context());

		expect(res.status).toBe(401);
		expect(JSON.parse(res.body ?? "{}")).toMatchObject({
			ok: false,
			code: "unauthorized",
			requestId: expect.any(String),
		});
		expect(res.headers?.["x-request-id"]).toBeTruthy();
	});

	it("rejects browser origins not on the explicit allowlist", async () => {
		const res = response();
		await dispatch(
			request("GET", "/status", {
				origin: "chrome-extension://untrusted",
				authorization: "Bearer secret-token",
			}),
			res,
			context(["chrome-extension://trusted"]),
		);

		expect(res.status).toBe(403);
		expect(res.headers?.["Access-Control-Allow-Origin"]).toBeUndefined();
	});

	it("returns CORS headers only for an allowed preflight origin", async () => {
		const res = response();
		await dispatch(
			request("OPTIONS", "/cards", {
				origin: "chrome-extension://trusted",
			}),
			res,
			context(["chrome-extension://trusted"]),
		);

		expect(res.status).toBe(204);
		expect(res.headers?.["Access-Control-Allow-Origin"]).toBe(
			"chrome-extension://trusted",
		);
		expect(res.headers?.Vary).toBe("Origin");
	});
});
