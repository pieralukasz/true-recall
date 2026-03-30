import { __awaiter } from "tslib";
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};
export function sendJson(res, status, body) {
    res.writeHead(status, Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS));
    res.end(JSON.stringify(body));
}
export function sendOk(res, data) {
    sendJson(res, 200, { ok: true, data });
}
export function sendError(res, status, message) {
    sendJson(res, status, { ok: false, error: message });
}
export { CORS_HEADERS };
const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2 MB
export function readBody(req) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            let body = "";
            let size = 0;
            req.on("data", (chunk) => {
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
    });
}
export function parseJsonBody(raw) {
    try {
        return JSON.parse(raw);
    }
    catch (e) {
        console.warn("[True Recall API] JSON parse failed:", e instanceof Error ? e.message : e);
        return null;
    }
}
