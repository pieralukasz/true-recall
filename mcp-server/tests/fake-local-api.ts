import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type RecordedRequest = {
	method: string;
	path: string;
	body: unknown;
	authorization?: string;
};

type Reply = { status?: number; body: unknown };

/**
 * A stand-in for the plugin's local API: records every request and answers
 * with `{ ok: true, data }` unless a route override says otherwise.
 */
export class FakeLocalApi {
	readonly requests: RecordedRequest[] = [];
	private readonly replies = new Map<string, Reply>();
	private server?: Server;
	port = 0;

	/** Override the reply for "METHOD /path" (path without query). */
	reply(route: string, reply: Reply): void {
		this.replies.set(route, reply);
	}

	async start(): Promise<void> {
		this.server = createServer((req, res) => {
			let raw = "";
			req.on("data", (chunk) => {
				raw += chunk;
			});
			req.on("end", () => {
				const method = req.method ?? "GET";
				const path = req.url ?? "/";
				this.requests.push({
					method,
					path,
					body: raw ? JSON.parse(raw) : undefined,
					authorization: req.headers.authorization,
				});
				const route = `${method} ${path.split("?")[0]}`;
				const reply = this.replies.get(route) ?? {
					body: { ok: true, data: { route } },
				};
				res.writeHead(reply.status ?? 200, {
					"Content-Type": "application/json",
				});
				res.end(JSON.stringify(reply.body));
			});
		});
		await new Promise<void>((resolve) =>
			this.server?.listen(0, "127.0.0.1", resolve),
		);
		this.port = (this.server.address() as AddressInfo).port;
	}

	async stop(): Promise<void> {
		await new Promise<void>((resolve) => this.server?.close(() => resolve()));
	}

	last(): RecordedRequest | undefined {
		return this.requests.at(-1);
	}
}
