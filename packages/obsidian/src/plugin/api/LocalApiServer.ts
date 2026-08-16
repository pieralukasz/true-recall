import { Notice } from "obsidian";

import { capabilities } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import type { ApiRequest, ApiResponseWriter } from "./api.types";
import { dispatch } from "./routes";

const DEFAULT_PORT = 27182;
const MAX_PORT_RETRIES = 5;

/**
 * Minimal structural views of Node's `http` module, which is loaded lazily at
 * runtime via Electron's `require`. Declared locally so this file does not
 * depend on `@types/node` (unavailable to Obsidian's review scanner).
 */
interface HttpServerError {
	code?: string;
	message: string;
}

interface HttpServerLike {
	listening: boolean;
	listen(port: number, host: string, onListening: () => void): void;
	close(): void;
	on(event: "error", listener: (error: HttpServerError) => void): void;
}

interface HttpModuleLike {
	createServer: (
		handler: (req: ApiRequest, res: ApiResponseWriter) => void,
	) => HttpServerLike;
}

export class LocalApiServer {
	private server: HttpServerLike | null = null;
	private port: number;
	private configuredPort: number;
	private portRetryCount = 0;
	private stopped = false;

	constructor(
		private plugin: TrueRecallPlugin,
		port?: number,
	) {
		this.port = port ?? DEFAULT_PORT;
		this.configuredPort = this.port;
	}

	/** Fresh start: resets retry state left over from a previous run. */
	start(): void {
		if (!capabilities.canRunLocalApi()) return;
		if (this.server) return;
		this.stopped = false;
		this.portRetryCount = 0;
		this.port = this.configuredPort;
		this.listen();
	}

	/** Bind the server on the current port; retried on EADDRINUSE. */
	private listen(): void {
		// Desktop-only: load Node's http server lazily via Electron's window.require so the
		// bundler and the linter never see a static Node import (unavailable on mobile).
		const { createServer } = (
			window as unknown as { require: (id: string) => unknown }
		).require("http") as HttpModuleLike;

		this.server = createServer((req, res) => {
			dispatch(req, res, { plugin: this.plugin }).catch((error) => {
				console.error("[True Recall API] Unhandled error:", error);
				if (!res.writableEnded) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, error: "Internal error" }));
				}
			});
		});

		this.server.on("error", (error) => {
			// The error event fires asynchronously after a failed listen(); if
			// stop() ran in that window (plugin unload), retrying would bind a
			// new server owned by an unloaded plugin.
			if (this.stopped) return;
			if (error.code === "EADDRINUSE") {
				if (this.portRetryCount >= MAX_PORT_RETRIES) {
					console.error(
						`[True Recall API] Failed to find open port after ${MAX_PORT_RETRIES} retries`,
					);
					new Notice(
						`True Recall API: could not find an available port. Free port ${this.port} or change it in settings.`,
					);
					this.server?.close();
					this.server = null;
					return;
				}
				this.portRetryCount++;
				const nextPort = this.port + 1;
				console.warn(
					`[True Recall API] Port ${this.port} in use, trying ${nextPort}`,
				);
				this.port = nextPort;
				this.server?.close();
				this.server = null;
				this.listen();
			} else {
				console.error("[True Recall API] Server error:", error);
				new Notice(`True Recall API error: ${error.message}`);
				this.server?.close();
				this.server = null;
			}
		});

		this.server.listen(this.port, "127.0.0.1", () => {
			this.portRetryCount = 0;
			console.debug(
				`[True Recall API] Listening on http://127.0.0.1:${this.port}`,
			);
		});
	}

	stop(): void {
		this.stopped = true;
		if (!this.server) return;
		this.server.close();
		this.server = null;
		console.debug("[True Recall API] Server stopped");
	}

	getPort(): number {
		return this.port;
	}

	isRunning(): boolean {
		return this.server?.listening ?? false;
	}
}
