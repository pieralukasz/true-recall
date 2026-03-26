import type { IncomingMessage, ServerResponse } from "http";
import type TrueRecallPlugin from "../../main";

export interface ApiContext {
	plugin: TrueRecallPlugin;
}

export type RouteHandler = (
	req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
	params: Record<string, string>,
) => Promise<void>;

export type ApiResponse<T = unknown> =
	| { ok: true; data: T }
	| { ok: false; error: string };

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
} as const;

export function sendJson(
	res: ServerResponse,
	status: number,
	body: ApiResponse,
): void {
	res.writeHead(status, {
		"Content-Type": "application/json",
		...CORS_HEADERS,
	});
	res.end(JSON.stringify(body));
}

export function sendOk<T>(res: ServerResponse, data: T): void {
	sendJson(res, 200, { ok: true, data });
}

export function sendError(
	res: ServerResponse,
	status: number,
	message: string,
): void {
	sendJson(res, status, { ok: false, error: message });
}

export { CORS_HEADERS };

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2 MB

export async function readBody(req: IncomingMessage): Promise<string> {
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
