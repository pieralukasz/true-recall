import { AIRequestError } from "@true-recall/core/ai/clients/openrouter-client";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

function requirePro(ctx: ApiContext, res: ApiResponseWriter): boolean {
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

function parseSinceMs(since?: string): number | undefined {
	if (!since) return undefined;
	// Support relative durations like "7d", "24h", "30m"
	const match = /^(\d+)([dhm])$/.exec(since);
	if (match) {
		const value = Number(match[1]);
		const unit = match[2] ?? "d";
		const multipliers: Record<string, number> = {
			d: 86400000,
			h: 3600000,
			m: 60000,
		};
		return Date.now() - value * (multipliers[unit] ?? 0);
	}
	// Try ISO date
	const ts = Date.parse(since);
	return Number.isNaN(ts) ? undefined : ts;
}

export async function handleRagSearch(
	req: ApiRequest,
	res: ApiResponseWriter,
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
		sourceIds?: string[];
		since?: string;
		groupBySource?: boolean;
	}>(body);

	if (!data?.query) {
		sendError(res, 400, "Missing 'query' field");
		return;
	}

	try {
		const search = ctx.plugin.ragSearch;
		if (!search) {
			sendError(res, 400, "RAG not initialized");
			return;
		}
		const result = await search.search(data.query, {
			topK: data.topK,
			sourceType: data.sourceType,
			sourceIds: data.sourceIds,
			sinceMs: parseSinceMs(data.since),
			groupBySource: data.groupBySource,
		});

		// Enrich flashcard results with sourceNotePath
		const fmIndex = ctx.plugin.frontmatterIndex;
		if (fmIndex) {
			for (const r of result.results) {
				if (r.sourceNoteUid) {
					r.sourceNotePath =
						fmIndex.getFileByValue("flashcard_uid", r.sourceNoteUid) ??
						undefined;
				}
			}
			if (result.grouped) {
				for (const g of result.grouped) {
					// Resolve path from first chunk's sourceNoteUid
					const uid = g.chunks[0]?.sourceNoteUid;
					if (uid) {
						const path = fmIndex.getFileByValue("flashcard_uid", uid);
						if (path) {
							g.sourceNotePath = path;
							g.displayName =
								path.split("/").pop()?.replace(/\.md$/, "") ?? g.displayName;
						}
					}
				}
			}
		}

		sendOk(res, result);
	} catch (e) {
		const msg =
			e instanceof AIRequestError
				? `Embedding API error: ${e.message}`
				: `Search failed: ${e instanceof Error ? e.message : "Unknown error"}`;
		console.error("[True Recall RAG] Search handler error:", e);
		sendError(res, 500, msg);
	}
}

export async function handleRagIndex(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!requirePro(ctx, res)) return;
	if (!ctx.plugin.ragIndexer) {
		sendError(res, 400, "RAG indexer not initialized");
		return;
	}

	try {
		const raw = await readBody(req);
		const body = parseJsonBody<{ force?: boolean }>(raw);
		const force = body?.force === true;
		const result = await ctx.plugin.ragIndexer.fullReindex(undefined, {
			force,
		});
		sendOk(res, result);
	} catch (e) {
		console.error("[True Recall RAG] Index handler error:", e);
		sendError(
			res,
			500,
			`Indexing failed: ${e instanceof Error ? e.message : "Unknown error"}`,
		);
	}
}

export function handleRagStatus(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!requirePro(ctx, res)) return;
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
		sendOk(res, {
			enabled: ctx.plugin.settings.ragEnabled,
			...stats,
		});
	} catch (e) {
		console.error("[True Recall RAG] Status handler error:", e);
		sendError(
			res,
			500,
			`Status check failed: ${e instanceof Error ? e.message : "Unknown error"}`,
		);
	}
}
