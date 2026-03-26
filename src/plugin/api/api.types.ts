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

export interface ApiResponse<T = unknown> {
	ok: boolean;
	data?: T;
	error?: string;
}

export function sendJson(
	res: ServerResponse,
	status: number,
	body: ApiResponse,
): void {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "http://localhost",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
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

export async function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}

export function parseJsonBody<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}
