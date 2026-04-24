import type TrueRecallPlugin from "../../main";

export interface ApiRequest {
	url?: string;
	method?: string;
	on(event: "data", listener: (chunk: Buffer) => void): void;
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
}

export type RouteHandler = (
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
) => void | Promise<void>;

type ApiResponseBody<T = unknown> =
	| { ok: true; data: T }
	| { ok: false; error: string };

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
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
): void {
	sendJson(res, status, { ok: false, error: message });
}

export { CORS_HEADERS };

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2 MB

export async function readBody(req: ApiRequest): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		let size = 0;
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_BODY_SIZE) {
				req.destroy();
				reject(new Error("Request body too large"));
				return;
			}
			body += chunk.toString();
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}

export function parseJsonBody<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch (e) {
		console.warn(
			"[True Recall API] JSON parse failed:",
			e instanceof Error ? e.message : e,
		);
		return null;
	}
}
