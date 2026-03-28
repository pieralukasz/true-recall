import type { IncomingMessage, ServerResponse } from "node:http";
import { AIRequestError } from "@features/ai/services/openrouter-client";
import { RagEmbeddingService } from "@features/rag/services/rag-embedding.service";
import { RagSearchService } from "@features/rag/services/rag-search.service";
import type { ApiContext } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

function requirePro(ctx: ApiContext, res: ServerResponse): boolean {
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

export async function handleRagSearch(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!requirePro(ctx, res)) return;
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const body = await readBody(req);
	const data = parseJsonBody<{
		query: string;
		topK?: number;
		sourceType?: "note" | "flashcard" | "all";
	}>(body);

	if (!data?.query) {
		sendError(res, 400, "Missing 'query' field");
		return;
	}

	const actions = ctx.plugin.cardStore.rag;
	const embedder = new RagEmbeddingService(ctx.plugin.settings.proKey ?? "");
	const search = new RagSearchService(actions, embedder);

	const result = await search.search(data.query, data.topK, data.sourceType);
	sendOk(res, result);
}

export async function handleRagIndex(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!requirePro(ctx, res)) return;
	if (!ctx.plugin.ragIndexer) {
		sendError(res, 400, "RAG indexer not initialized");
		return;
	}

	const result = await ctx.plugin.ragIndexer.fullReindex();
	sendOk(res, result);
}

export async function handleRagStatus(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!requirePro(ctx, res)) return;
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const stats = ctx.plugin.cardStore.rag.getStats();
	sendOk(res, {
		enabled: ctx.plugin.settings.ragEnabled,
		...stats,
	});
}
