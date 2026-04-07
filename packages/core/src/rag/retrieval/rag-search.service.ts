import { RAG_CONFIG } from "@true-recall/core/constants";
import type {
	EmbeddingRow,
	RagChunkActions,
	RagSourceType,
} from "../indexing/rag-chunk-actions";

export interface RagEmbeddingService {
	embedSingle(text: string): Promise<Float32Array>;
	embed(texts: string[]): Promise<Float32Array[]>;
}

export interface SearchResult {
	chunkId: number;
	content: string;
	headingBreadcrumb: string;
	sourceType: RagSourceType;
	sourceId: string;
	/** For flashcards: the source_uid linking to the originating note */
	sourceNoteUid?: string;
	/** Resolved file path of the source note (enriched post-search) */
	sourceNotePath?: string;
	score: number;
	tokenCount: number;
	/** Source file modification time (ms since epoch) from rag_index_meta */
	modifiedAt?: number;
	fsrs?: {
		state: number;
		stability: number;
		difficulty: number;
		lapses: number;
		reps: number;
		lastReview?: string;
		due: string;
	};
}

export interface SearchOptions {
	topK?: number;
	sourceType?: RagSourceType | "all";
	sourceIds?: string[];
	/** Only return results modified after this timestamp (ms since epoch) */
	sinceMs?: number;
	/** Group results by source note/flashcard origin */
	groupBySource?: boolean;
}

export interface GroupedSearchResult {
	sourceId: string;
	sourceType: RagSourceType;
	displayName: string;
	/** Resolved note path (enriched post-search) */
	sourceNotePath?: string;
	headings: string[];
	bestScore: number;
	modifiedAt?: number;
	chunks: SearchResult[];
}

export interface SearchResponse {
	results: SearchResult[];
	grouped?: GroupedSearchResult[];
	stats: SearchStats;
}

export interface SearchStats {
	totalChunksSearched: number;
	notesMatched: number;
	flashcardsMatched: number;
	flashcardsByState: {
		new: number;
		learning: number;
		review: number;
		relearning: number;
	};
}

export class RagSearchService {
	private embeddingCache: Map<number, Float32Array> | null = null;

	constructor(
		private actions: RagChunkActions,
		private embedder: RagEmbeddingService,
	) {}

	async search(
		query: string,
		topKOrOpts?: number | SearchOptions,
		sourceType?: RagSourceType | "all",
		sourceIds?: string[],
	): Promise<SearchResponse> {
		const opts: SearchOptions =
			typeof topKOrOpts === "object"
				? topKOrOpts
				: {
						topK: topKOrOpts,
						sourceType,
						sourceIds,
					};

		const topK = opts.topK ?? RAG_CONFIG.defaultTopK;
		const effSourceType = opts.sourceType;
		const effSourceIds = opts.sourceIds;
		const sinceMs = opts.sinceMs;

		// Over-fetch when filtering so we still get topK results after filtering
		const isFiltered =
			(effSourceType && effSourceType !== "all") ||
			(effSourceIds && effSourceIds.length > 0) ||
			sinceMs !== undefined;
		const fetchMultiplier = isFiltered ? 4 : 2;
		const fetchSize = topK * fetchMultiplier;

		const ftsResults = this.actions.searchFts(query, fetchSize);

		let queryEmbedding: Float32Array | null = null;
		try {
			queryEmbedding = await this.embedder.embedSingle(query);
		} catch {
			// Embedding service unavailable — fall back to keyword search
		}

		let vectorResults: { id: number; score: number }[] = [];
		if (queryEmbedding) {
			vectorResults = this.cosineSearch(queryEmbedding, fetchSize);
		}

		const vectorPassedIds = new Set(vectorResults.map((r) => r.id));
		const merged = this.rrfMerge(ftsResults, vectorResults, fetchSize);

		// When vector search is available, filter out FTS-only noise
		const filtered = queryEmbedding
			? merged.filter((m) => vectorPassedIds.has(m.id))
			: merged;

		const chunkIds = filtered.map((m) => m.id);
		const chunks = this.actions.getChunksByIds(chunkIds);
		const chunkMap = new Map(chunks.map((c) => [c.id, c]));

		const fsrsData = this.actions.getFsrsDataForChunks(chunkIds);
		const fsrsMap = new Map(fsrsData.map((f) => [f.card_id, f]));
		const mtimeMap = this.actions.getMtimeForChunks(chunkIds);

		const results: SearchResult[] = [];
		for (const m of filtered) {
			const chunk = chunkMap.get(m.id);
			if (!chunk) continue;

			if (
				effSourceType &&
				effSourceType !== "all" &&
				chunk.source_type !== effSourceType
			)
				continue;

			if (
				effSourceIds &&
				effSourceIds.length > 0 &&
				!effSourceIds.includes(chunk.source_id)
			)
				continue;

			const mtime = mtimeMap.get(chunk.id);
			if (sinceMs !== undefined && (mtime === undefined || mtime < sinceMs))
				continue;

			const result: SearchResult = {
				chunkId: chunk.id,
				content: chunk.content,
				headingBreadcrumb: chunk.heading_breadcrumb,
				sourceType: chunk.source_type,
				sourceId: chunk.source_id,
				score: m.score,
				tokenCount: chunk.token_count,
				modifiedAt: mtime,
			};

			if (chunk.source_type === "flashcard") {
				const fsrs = fsrsMap.get(chunk.source_id);
				if (fsrs) {
					result.sourceNoteUid = fsrs.source_uid ?? undefined;
					result.fsrs = {
						state: fsrs.state,
						stability: fsrs.stability,
						difficulty: fsrs.difficulty,
						lapses: fsrs.lapses,
						reps: fsrs.reps,
						lastReview: fsrs.last_review ?? undefined,
						due: fsrs.due,
					};
				}
			}

			results.push(result);
		}

		const trimmed = results.slice(0, topK);
		const stats = this.computeStats(trimmed);

		const response: SearchResponse = { results: trimmed, stats };

		if (opts.groupBySource) {
			response.grouped = this.groupBySource(trimmed);
		}

		return response;
	}

	private groupBySource(results: SearchResult[]): GroupedSearchResult[] {
		const groups = new Map<string, GroupedSearchResult>();

		for (const r of results) {
			// Group flashcards by their source note when available
			const key =
				r.sourceType === "flashcard" && r.sourceNoteUid
					? `note:${r.sourceNoteUid}`
					: `${r.sourceType}:${r.sourceId}`;

			const existing = groups.get(key);
			if (existing) {
				existing.chunks.push(r);
				if (
					r.headingBreadcrumb &&
					!existing.headings.includes(r.headingBreadcrumb)
				) {
					existing.headings.push(r.headingBreadcrumb);
				}
				if (r.score > existing.bestScore) existing.bestScore = r.score;
				if (r.modifiedAt) {
					existing.modifiedAt = Math.max(
						existing.modifiedAt ?? 0,
						r.modifiedAt,
					);
				}
			} else {
				groups.set(key, {
					sourceId: r.sourceId,
					sourceType: r.sourceType,
					displayName: this.makeGroupDisplayName(r),
					headings: r.headingBreadcrumb ? [r.headingBreadcrumb] : [],
					bestScore: r.score,
					modifiedAt: r.modifiedAt,
					chunks: [r],
				});
			}
		}

		return Array.from(groups.values()).sort(
			(a, b) => b.bestScore - a.bestScore,
		);
	}

	private makeGroupDisplayName(r: SearchResult): string {
		if (r.sourceType === "note") {
			const parts = r.sourceId.split("/");
			const filename = parts[parts.length - 1] ?? r.sourceId;
			return filename.replace(/\.md$/, "");
		}
		const qMatch = r.content.match(/^Q:\s*([^\n]+)/);
		return (qMatch?.[1]?.trim() || r.content.slice(0, 50)).slice(0, 50);
	}

	private cosineSearch(
		queryEmbedding: Float32Array,
		topK: number,
	): { id: number; score: number }[] {
		this.ensureEmbeddingCache();
		if (!this.embeddingCache) return [];

		const scored: { id: number; score: number }[] = [];
		for (const [id, embedding] of this.embeddingCache) {
			const score = cosineSimilarity(queryEmbedding, embedding);
			if (score >= RAG_CONFIG.cosineThreshold) {
				scored.push({ id, score });
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, topK);
	}

	private ensureEmbeddingCache(): void {
		if (this.embeddingCache) return;

		const rows: EmbeddingRow[] = this.actions.getAllEmbeddings();
		this.embeddingCache = new Map();

		for (const row of rows) {
			const float32 = new Float32Array(
				row.embedding.buffer,
				row.embedding.byteOffset,
				row.embedding.byteLength / 4,
			);
			this.embeddingCache.set(row.id, float32);
		}
	}

	invalidateCache(): void {
		this.embeddingCache = null;
	}

	// Reciprocal Rank Fusion: merges FTS5 keyword and vector rankings. k=60 is the standard smoothing constant (Cormack et al. 2009).
	private rrfMerge(
		ftsResults: { id: number; rank: number }[],
		vectorResults: { id: number; score: number }[],
		topK: number,
	): { id: number; score: number }[] {
		const k = RAG_CONFIG.rrf_k;
		const scores = new Map<number, number>();

		for (let i = 0; i < ftsResults.length; i++) {
			const r = ftsResults[i];
			if (!r) continue;
			const current = scores.get(r.id) ?? 0;
			scores.set(r.id, current + 1 / (k + i + 1));
		}

		for (let i = 0; i < vectorResults.length; i++) {
			const r = vectorResults[i];
			if (!r) continue;
			const current = scores.get(r.id) ?? 0;
			scores.set(r.id, current + 1 / (k + i + 1));
		}

		return Array.from(scores.entries())
			.map(([id, score]) => ({ id, score }))
			.sort((a, b) => b.score - a.score)
			.slice(0, topK);
	}

	private computeStats(results: SearchResult[]): SearchStats {
		const noteIds = new Set<string>();
		const fcIds = new Set<string>();
		const byState = { new: 0, learning: 0, review: 0, relearning: 0 };

		for (const r of results) {
			if (r.sourceType === "note") noteIds.add(r.sourceId);
			else {
				fcIds.add(r.sourceId);
				if (r.fsrs) {
					const s = r.fsrs.state;
					if (s === 0) byState.new++;
					else if (s === 1) byState.learning++;
					else if (s === 2) byState.review++;
					else if (s === 3) byState.relearning++;
				}
			}
		}

		return {
			totalChunksSearched: this.embeddingCache?.size ?? 0,
			notesMatched: noteIds.size,
			flashcardsMatched: fcIds.size,
			flashcardsByState: byState,
		};
	}
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		const ai = a[i] ?? 0;
		const bi = b[i] ?? 0;
		dot += ai * bi;
		normA += ai * ai;
		normB += bi * bi;
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}
