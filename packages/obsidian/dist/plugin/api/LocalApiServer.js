// eslint-disable-next-line import/no-nodejs-modules -- MCP server communication requires Node.js HTTP server on localhost
import { createServer } from "http";
import { Notice } from "obsidian";
import { dispatch } from "./routes";
const DEFAULT_PORT = 27182;
const MAX_PORT_RETRIES = 5;
export class LocalApiServer {
    constructor(plugin, port) {
        this.plugin = plugin;
        this.server = null;
        this.portRetryCount = 0;
        this.port = port !== null && port !== void 0 ? port : DEFAULT_PORT;
    }
    start() {
        if (this.server)
            return;
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
            var _a, _b, _c;
            if (error.code === "EADDRINUSE") {
                if (this.portRetryCount >= MAX_PORT_RETRIES) {
                    console.error(`[True Recall API] Failed to find open port after ${MAX_PORT_RETRIES} retries`);
                    new Notice(`True Recall API: could not find an available port. Free port ${this.port} or change it in settings.`);
                    (_a = this.server) === null || _a === void 0 ? void 0 : _a.close();
                    this.server = null;
                    return;
                }
                this.portRetryCount++;
                const nextPort = this.port + 1;
                console.warn(`[True Recall API] Port ${this.port} in use, trying ${nextPort}`);
                this.port = nextPort;
                (_b = this.server) === null || _b === void 0 ? void 0 : _b.close();
                this.server = null;
                this.start();
            }
            else {
                console.error("[True Recall API] Server error:", error);
                new Notice(`True Recall API error: ${error.message}`);
                (_c = this.server) === null || _c === void 0 ? void 0 : _c.close();
                this.server = null;
            }
        });
        this.server.listen(this.port, "127.0.0.1", () => {
            this.portRetryCount = 0;
            console.debug(`[True Recall API] Listening on http://127.0.0.1:${this.port}`);
        });
    }
    stop() {
        if (!this.server)
            return;
        this.server.close();
        this.server = null;
        console.debug("[True Recall API] Server stopped");
    }
    getPort() {
        return this.port;
    }
    isRunning() {
        var _a, _b;
        return (_b = (_a = this.server) === null || _a === void 0 ? void 0 : _a.listening) !== null && _b !== void 0 ? _b : false;
    }
}
