import type {
	EmbeddingRow,
	RagChunkActions,
	RagSourceType,
} from "@features/rag/persistence/rag-chunk-actions";
import { RAG_CONFIG } from "@shared/constants";
import type { RagEmbeddingService } from "./rag-embedding.service";

export interface SearchResult {
	chunkId: number;
	content: string;
	headingBreadcrumb: string;
	sourceType: RagSourceType;
	sourceId: string;
	/** For flashcards: the source_uid linking to the originating note */
	sourceNoteUid?: string;
	score: number;
	tokenCount: number;
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
		topK: number = RAG_CONFIG.defaultTopK,
		sourceType?: RagSourceType | "all",
	): Promise<{ results: SearchResult[]; stats: SearchStats }> {
		const ftsResults = this.actions.searchFts(query, topK * 2);

		const queryEmbedding = await this.embedder.embedSingle(query);
		const vectorResults = this.cosineSearch(queryEmbedding, topK * 2);

		// Track which chunks passed vector threshold — FTS-only results without
		// sufficient cosine similarity are noise
		const vectorPassedIds = new Set(vectorResults.map((r) => r.id));

		const merged = this.rrfMerge(ftsResults, vectorResults, topK).filter((m) =>
			vectorPassedIds.has(m.id),
		);

		const chunkIds = merged.map((m) => m.id);
		const chunks = this.actions.getChunksByIds(chunkIds);
		const chunkMap = new Map(chunks.map((c) => [c.id, c]));

		const fsrsData = this.actions.getFsrsDataForChunks(chunkIds);
		const fsrsMap = new Map(fsrsData.map((f) => [f.card_id, f]));

		const results: SearchResult[] = [];
		for (const m of merged) {
			const chunk = chunkMap.get(m.id);
			if (!chunk) continue;

			if (
				sourceType &&
				sourceType !== "all" &&
				chunk.source_type !== sourceType
			)
				continue;

			const result: SearchResult = {
				chunkId: chunk.id,
				content: chunk.content,
				headingBreadcrumb: chunk.heading_breadcrumb,
				sourceType: chunk.source_type,
				sourceId: chunk.source_id,
				score: m.score,
				tokenCount: chunk.token_count,
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

		const stats = this.computeStats(results);
		return { results: results.slice(0, topK), stats };
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
