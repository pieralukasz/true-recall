import { __awaiter } from "tslib";
import { AIRequestError } from "@true-recall/core/ai/clients/openrouter-client";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
function requirePro(ctx, res) {
    if (!ctx.plugin.settings.proKey) {
        sendError(res, 403, "Pro subscription required for Knowledge Base");
        return false;
    }
    if (!ctx.plugin.settings.ragEnabled) {
        sendError(res, 400, "Knowledge Base is not enabled in settings");
        return false;
    }
    return true;
}
export function handleRagSearch(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!requirePro(ctx, res))
            return;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const body = yield readBody(req);
        const data = parseJsonBody(body);
        if (!(data === null || data === void 0 ? void 0 : data.query)) {
            sendError(res, 400, "Missing 'query' field");
            return;
        }
        try {
            const search = ctx.plugin.ragSearch;
            if (!search) {
                sendError(res, 400, "RAG not initialized");
                return;
            }
            const result = yield search.search(data.query, data.topK, data.sourceType, data.sourceIds);
            sendOk(res, result);
        }
        catch (e) {
            const msg = e instanceof AIRequestError
                ? `Embedding API error: ${e.message}`
                : `Search failed: ${e instanceof Error ? e.message : "Unknown error"}`;
            console.error("[True Recall RAG] Search handler error:", e);
            sendError(res, 500, msg);
        }
    });
}
export function handleRagIndex(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!requirePro(ctx, res))
            return;
        if (!ctx.plugin.ragIndexer) {
            sendError(res, 400, "RAG indexer not initialized");
            return;
        }
        try {
            const result = yield ctx.plugin.ragIndexer.fullReindex();
            sendOk(res, result);
        }
        catch (e) {
            console.error("[True Recall RAG] Index handler error:", e);
            sendError(res, 500, `Indexing failed: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
    });
}
export function handleRagStatus(_req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!requirePro(ctx, res))
            return;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        try {
            const actions = ctx.plugin.ragActions;
            if (!actions) {
                sendError(res, 400, "RAG not initialized");
                return;
            }
            const stats = actions.getStats();
            sendOk(res, Object.assign({ enabled: ctx.plugin.settings.ragEnabled }, stats));
        }
        catch (e) {
            console.error("[True Recall RAG] Status handler error:", e);
            sendError(res, 500, `Status check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
    });
}
