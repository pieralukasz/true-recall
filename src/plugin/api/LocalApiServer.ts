import { createServer, type Server } from "http";
import type TrueRecallPlugin from "../../main";
import { dispatch } from "./routes";

const DEFAULT_PORT = 27182;

export class LocalApiServer {
	private server: Server | null = null;
	private port: number;

	constructor(
		private plugin: TrueRecallPlugin,
		port?: number,
	) {
		this.port = port ?? DEFAULT_PORT;
	}

	start(): void {
		if (this.server) return;

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
				console.warn(
					`[True Recall API] Port ${this.port} in use, trying ${this.port + 1}`,
				);
				this.port++;
				this.server?.close();
				this.server = null;
				this.start();
			} else {
				console.error("[True Recall API] Server error:", error);
			}
		});

		this.server.listen(this.port, "127.0.0.1", () => {
			console.log(
				`[True Recall API] Listening on http://127.0.0.1:${this.port}`,
			);
		});
	}

	stop(): void {
		if (!this.server) return;
		this.server.close();
		this.server = null;
		console.log("[True Recall API] Server stopped");
	}

	getPort(): number {
		return this.port;
	}

	isRunning(): boolean {
		return this.server !== null && this.server.listening;
	}
}
