import { HttpError } from "@true-recall/core/errors";

import type TrueRecallPlugin from "../../main";

export interface ApiRequest {
	url?: string;
	method?: string;
	headers: Record<string, string | string[] | undefined>;
	// Node emits Buffer chunks; Buffer is a Uint8Array subclass, so typing the
	// contract structurally avoids depending on `@types/node`.
	on(event: "data", listener: (chunk: Uint8Array) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (err: Error) => void): void;
	destroy(): void;
}

export interface ApiResponseWriter {
	writableEnded?: boolean;
	writeHead(statusCode: number, headers?: Record<string, string>): void;
	end(data?: string): void;
}

export interface ApiContext {
	plugin: TrueRecallPlugin;
	apiToken: string;
}

export type RouteHandler = (
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
) => void | Promise<void>;

type ApiResponseBody<T = unknown> =
	| { ok: true; data: T }
	| {
			ok: false;
			error: string;
			code?: string;
			retryable?: boolean;
			requestId?: string;
	  };

const CORS_HEADERS = {
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Authorization, Content-Type, X-True-Recall-Token",
} as const;

function sendJson(
	res: ApiResponseWriter,
	status: number,
	body: ApiResponseBody,
): void {
	res.writeHead(status, {
		"Content-Type": "application/json",
		...CORS_HEADERS,
	});
	res.end(JSON.stringify(body));
}

export function sendOk<T>(res: ApiResponseWriter, data: T): void {
	sendJson(res, 200, { ok: true, data });
}

export function sendError(
	res: ApiResponseWriter,
	status: number,
	message: string,
	metadata: { code?: string; retryable?: boolean; requestId?: string } = {},
): void {
	sendJson(res, status, { ok: false, error: message, ...metadata });
}

export { CORS_HEADERS };

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2 MB

export async function readBody(req: ApiRequest): Promise<string> {
	return new Promise((resolve, reject) => {
		// Streaming decode so multibyte UTF-8 sequences split across chunk
		// boundaries are reassembled correctly.
		const decoder = new TextDecoder();
		let body = "";
		let size = 0;
		let settled = false;
		req.on("data", (chunk) => {
			if (settled) return;
			size += chunk.length;
			if (size > MAX_BODY_SIZE) {
				// Stop retaining bytes but keep the socket alive long enough for the
				// router to return the structured 413 response to the client.
				settled = true;
				reject(
					new HttpError(413, {
						backendCode: "payload-too-large",
					}),
				);
				return;
			}
			body += decoder.decode(chunk, { stream: true });
		});
		req.on("end", () => {
			if (settled) return;
			settled = true;
			resolve(body + decoder.decode());
		});
		req.on("error", (error) => {
			if (settled) return;
			settled = true;
			reject(error);
		});
	});
}

interface SafeParser<T> {
	safeParse(
		value: unknown,
	): { success: true; data: T } | { success: false; error: unknown };
}

export function parseJsonBody<T>(
	raw: string,
	schema?: SafeParser<T>,
): T | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!schema) return parsed as T;
		const result = schema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch (e) {
		console.warn(
			"[True Recall API] JSON parse failed:",
			e instanceof Error ? e.message : e,
		);
		return null;
	}
}
