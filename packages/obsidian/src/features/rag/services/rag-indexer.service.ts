import { effect } from "@preact/signals-core";
import { type App, debounce, type Plugin, TFile } from "obsidian";

import { RAG_CONFIG, RAG_FREE_NOTE_LIMIT } from "@true-recall/core/constants";
import type {
	RagChunkActions,
	RagSourceType,
} from "@true-recall/core/rag/indexing/rag-chunk-actions";
import {
	chunkDailyNote,
	chunkFlashcard,
	chunkNote,
} from "@true-recall/core/rag/ingestion/rag-chunker.service";
import type {
	RagEmbeddingService,
	RagSearchService,
} from "@true-recall/core/rag/retrieval/rag-search.service";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

import { lastMutation } from "@true-recall/obsidian/services/signals";

import { detectDailyNote } from "./daily-note-detector";

function toUpsertChunks(
	chunks: { content: string; headingBreadcrumb: string; tokenCount: number }[],
	hash: string,
) {
	return chunks.map((c) => ({
		content: c.content,
		headingBreadcrumb: c.headingBreadcrumb,
		tokenCount: c.tokenCount,
		contentHash: hash,
	}));
}

interface IndexResult {
	indexed: number;
	skipped: number;
	errors: number;
	removed: number;
	embedded: number;
	embeddingTruncated: boolean;
	embeddingRemaining: number;
	flashcardsIndexed: number;
	flashcardsSkipped: number;
	noteLimitReached: boolean;
}

export interface IndexProgress {
	phase: "notes" | "flashcards" | "embedding";
	current: number;
	total: number;
}

export class RagIndexerService {
	private searchService: RagSearchService | null = null;

	constructor(
		private app: App,
		private actions: RagChunkActions,
		private embedder: RagEmbeddingService,
		private settings: () => TrueRecallSettings,
	) {}

	setSearchService(search: RagSearchService): void {
		this.searchService = search;
	}

	private get noteLimit(): number | undefined {
		return this.settings().proKey ? undefined : RAG_FREE_NOTE_LIMIT;
	}

	async fullReindex(
		onProgress?: (progress: IndexProgress) => void,
		options?: { force?: boolean },
	): Promise<IndexResult> {
		if (options?.force) {
			this.actions.deleteAll();
			this.searchService?.invalidateCache();
		}

		const result: IndexResult = {
			indexed: 0,
			skipped: 0,
			errors: 0,
			removed: 0,
			embedded: 0,
			embeddingTruncated: false,
			embeddingRemaining: 0,
			flashcardsIndexed: 0,
			flashcardsSkipped: 0,
			noteLimitReached: false,
		};
		const s = this.settings();

		const allEligible = this.app.vault
			.getMarkdownFiles()
			.filter((f) => this.shouldIndex(f));
		const limit = this.noteLimit;
		const files =
			limit != null && allEligible.length > limit
				? allEligible.slice(0, limit)
				: allEligible;
		result.noteLimitReached = limit != null && allEligible.length > limit;

		const totalFiles = files.length;
		for (let i = 0; i < files.length; i++) {
			try {
				const file = files[i];
				if (!file) continue;
				const wasIndexed = await this.indexFile(file);
				if (wasIndexed) result.indexed++;
				else result.skipped++;
			} catch (e) {
				console.error("[True Recall RAG] Index error:", e);
				result.errors++;
			}

			onProgress?.({ phase: "notes", current: i + 1, total: totalFiles });

			// Yield every 20 files to not block the event loop
			if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
		}

		// Clean up orphaned note sources (deleted from vault but still in index)
		const indexedSources = this.actions.getIndexedSources();
		const vaultPaths = new Set(files.map((f) => f.path));
		for (const src of indexedSources) {
			if (src.source_type === "note" && !vaultPaths.has(src.source_id)) {
				this.removeSource("note", src.source_id);
				result.removed++;
			}
		}

		if (s.ragIndexFlashcards) {
			const fcResult = await this.indexFlashcards(onProgress);
			result.flashcardsIndexed = fcResult.indexed;
			result.flashcardsSkipped = fcResult.skipped;
			result.errors += fcResult.errors;

			// Clean up orphaned flashcard sources
			const activeCardIds = new Set(
				this.actions.getFlashcardData().map((c) => c.id),
			);
			for (const src of indexedSources) {
				if (
					src.source_type === "flashcard" &&
					!activeCardIds.has(src.source_id)
				) {
					this.removeSource("flashcard", src.source_id);
					result.removed++;
				}
			}
		}

		const embedResult = await this.embedPending(onProgress);
		result.embedded = embedResult.embedded;
		result.embeddingTruncated = embedResult.truncated;
		result.embeddingRemaining = embedResult.remaining;

		return result;
	}

	async indexFile(file: TFile): Promise<boolean> {
		const content = await this.app.vault.cachedRead(file);
		const hash = await this.contentHash(content);

		const meta = this.actions.getIndexMeta("note", file.path);
		if (meta && meta.content_hash === hash) return false;

		const s = this.settings();
		const dailyInfo = detectDailyNote(
			this.app,
			file,
			s.ragDailyNotesFolder || undefined,
		);
		const chunks =
			dailyInfo.isDailyNote && dailyInfo.date
				? chunkDailyNote(content, dailyInfo, s.ragDailyNoteExcludeHeadings)
				: chunkNote(content);
		this.actions.upsertChunks("note", file.path, toUpsertChunks(chunks, hash));

		this.actions.upsertIndexMeta(
			"note",
			file.path,
			hash,
			file.stat.mtime,
			chunks.length,
		);

		return true;
	}

	removeSource(sourceType: RagSourceType, sourceId: string): void {
		this.actions.deleteBySource(sourceType, sourceId);
		this.actions.deleteIndexMeta(sourceType, sourceId);
	}

	registerCardSignals(plugin: Plugin): void {
		const debouncedCardIndex = debounce(
			async (cardIds: string[]) => {
				const s = this.settings();
				if (!s.ragEnabled || !s.ragAutoIndex || !s.ragIndexFlashcards) return;
				try {
					for (const id of cardIds) {
						await this.indexSingleCard(id);
					}
					await this.embedPending();
				} catch (e) {
					console.error("[True Recall RAG] Auto-index card error:", e);
				}
			},
			RAG_CONFIG.indexDebounceMs,
			true,
		);

		const dispose = effect(() => {
			const m = lastMutation.value;
			if (!m) return;

			if (m.type === "removed") {
				if (m.cardId) this.removeSource("flashcard", m.cardId);
				if (m.cardIds) {
					for (const id of m.cardIds) this.removeSource("flashcard", id);
				}
				return;
			}

			if (m.type === "added" || m.type === "updated") {
				const ids = m.cardId ? [m.cardId] : (m.cardIds ?? []);
				if (ids.length > 0) debouncedCardIndex(ids);
			}

			if (m.type === "bulk" && m.cardIds) {
				debouncedCardIndex(m.cardIds);
			}
		});

		plugin.register(() => dispose());
	}

	private async indexSingleCard(cardId: string): Promise<boolean> {
		const card = this.actions.getFlashcardDataById(cardId);
		if (!card) return false;

		const content = [card.fields_json, card.source_text ?? ""].join(" ");
		const hash = await this.contentHash(content);
		const meta = this.actions.getIndexMeta("flashcard", card.id);
		if (meta && meta.content_hash === hash) return false;

		const chunks = chunkFlashcard(
			card.fields_json,
			card.source_text ?? undefined,
			card.tags ?? undefined,
		);

		this.actions.upsertChunks(
			"flashcard",
			card.id,
			toUpsertChunks(chunks, hash),
		);
		this.actions.upsertIndexMeta(
			"flashcard",
			card.id,
			hash,
			Date.now(),
			chunks.length,
		);
		return true;
	}

	registerVaultEvents(plugin: Plugin): void {
		const debouncedIndex = debounce(
			async (file: TFile) => {
				if (!this.settings().ragEnabled || !this.settings().ragAutoIndex)
					return;
				if (!this.shouldIndex(file)) return;

				// Enforce note limit for non-Pro users during auto-index
				const limit = this.noteLimit;
				if (limit != null) {
					const stats = this.actions.getStats();
					if (stats.noteCount >= limit) return;
				}

				try {
					const wasIndexed = await this.indexFile(file);
					if (wasIndexed) await this.embedPending();
				} catch (e) {
					console.error("[True Recall RAG] Auto-index error:", e);
				}
			},
			RAG_CONFIG.indexDebounceMs,
			true,
		);

		plugin.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					debouncedIndex(file);
				}
			}),
		);

		plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					this.removeSource("note", file.path);
				}
			}),
		);

		plugin.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && file.extension === "md") {
					this.removeSource("note", oldPath);
					debouncedIndex(file);
				}
			}),
		);
	}

	private shouldIndex(file: TFile): boolean {
		const s = this.settings();
		const path = file.path;

		if (s.ragExcludeFolders.some((f) => path.startsWith(f))) return false;

		if (s.ragIncludeFolders.length > 0) {
			return s.ragIncludeFolders.some((f) => path.startsWith(f));
		}

		return true;
	}

	private async indexFlashcards(
		onProgress?: (progress: IndexProgress) => void,
	): Promise<{ indexed: number; skipped: number; errors: number }> {
		let indexed = 0;
		let skipped = 0;
		let errors = 0;

		const cards = this.actions.getFlashcardData();
		for (const [i, card] of cards.entries()) {
			try {
				const wasIndexed = await this.indexSingleCard(card.id);
				if (wasIndexed) indexed++;
				else skipped++;
			} catch (e) {
				console.error("[True Recall RAG] Flashcard index error:", e);
				errors++;
			}
			onProgress?.({
				phase: "flashcards",
				current: i + 1,
				total: cards.length,
			});
		}

		return { indexed, skipped, errors };
	}

	private async embedPending(
		onProgress?: (progress: IndexProgress) => void,
	): Promise<{ embedded: number; truncated: boolean; remaining: number }> {
		let totalEmbedded = 0;
		const totalPending = this.actions.countChunksWithoutEmbedding();
		const MAX_BATCHES = 1000;
		let batchCount = 0;

		while (batchCount < MAX_BATCHES) {
			const pending = this.actions.getChunksWithoutEmbedding(
				RAG_CONFIG.embeddingBatchSize,
			);
			if (pending.length === 0) break;

			const texts = pending.map((c) => c.content);
			const embeddings = await this.embedder.embed(texts);

			if (embeddings.length !== pending.length) {
				console.error(
					`[True Recall RAG] Embedding count mismatch: expected ${pending.length}, got ${embeddings.length}. Skipping batch.`,
				);
				break;
			}

			const updates: { chunkId: number; embedding: Float32Array }[] = [];
			for (let i = 0; i < pending.length; i++) {
				const chunk = pending[i];
				const emb = embeddings[i];
				if (!chunk || !emb || emb.length === 0) {
					console.warn(
						`[True Recall RAG] Empty embedding for chunk ${chunk?.id}, skipping`,
					);
					continue;
				}
				updates.push({ chunkId: chunk.id, embedding: emb });
			}

			this.actions.updateEmbeddingsBatch(updates);
			totalEmbedded += updates.length;
			batchCount++;

			onProgress?.({
				phase: "embedding",
				current: totalEmbedded,
				total: totalPending,
			});
		}

		if (totalEmbedded > 0) {
			this.searchService?.invalidateCache();
		}

		const remaining = this.actions.countChunksWithoutEmbedding();
		return { embedded: totalEmbedded, truncated: remaining > 0, remaining };
	}

	private async contentHash(content: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(content);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = new Uint8Array(hashBuffer);
		return Array.from(hashArray)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}
}
