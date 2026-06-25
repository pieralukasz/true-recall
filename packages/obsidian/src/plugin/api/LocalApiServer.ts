import { Notice, Platform } from "obsidian";

import type TrueRecallPlugin from "../../main";
import { dispatch } from "./routes";

const DEFAULT_PORT = 27182;
const MAX_PORT_RETRIES = 5;

export class LocalApiServer {
	private server: import("http").Server | null = null;
	private port: number;
	private portRetryCount = 0;

	constructor(
		private plugin: TrueRecallPlugin,
		port?: number,
	) {
		this.port = port ?? DEFAULT_PORT;
	}

	start(): void {
		if (!Platform.isDesktop) return;
		if (this.server) return;

		// Desktop-only: load Node's http server lazily via Electron's window.require so the
		// bundler and the linter never see a static Node import (unavailable on mobile).
		const { createServer } = (
			window as unknown as { require: (id: string) => unknown }
		).require("http") as typeof import("http");

		this.server = createServer((req, res) => {
			dispatch(req, res, { plugin: this.plugin }).catch((error) => {
				console.error("[True Recall API] Unhandled error:", error);
				if (!res.writableEnded) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, error: "Internal error" }));
				}
			});
		});

		this.server.on("error", (error: NodeJS.ErrnoException) => {
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
				this.start();
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
