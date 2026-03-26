import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { App, TFile } from "obsidian";
import type { AIClientConfig } from "./ai-client-config";
import { resolveAIClientConfig } from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { type ChunkingResult, chunkMarkdown } from "./markdown-chunker";
import { processCardEvents } from "./process-card-events";
import { buildCardFormatSpec } from "@features/ai/prompts/block-prompt-builder";
import {
	buildGenerationPrompt,
	FALLBACK_BASIC_NOTE_TYPE,
	type StreamingGenerationResult,
	StreamingGenerationService,
} from "./streaming-generation.service";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";
import {
	createThrottledPartialUpdater,
	finishStreaming,
	startStreaming,
	updateChunkProgress,
} from "./streaming-state";

const COST_CONFIRM_WORD_THRESHOLD = 5000;
const COST_PER_TOKEN = 0.15 / 1_000_000;

export interface ChunkedGenerationResult extends StreamingGenerationResult {
	failedChunks: number;
	totalChunks: number;
	errors: string[];
}

export class ChunkedGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private flashcardManager: FlashcardManager,
	) {}

	async generateFromNote(
		content: string,
		sourceFile: TFile,
		noteType?: NoteType | null,
		app?: App,
	): Promise<ChunkedGenerationResult> {
		const chunkingResult = chunkMarkdown(content);

		if (chunkingResult.strategy === "single") {
			const firstChunk = chunkingResult.chunks[0];
			if (!firstChunk) throw new Error("Expected at least one chunk");
			const streamingService = new StreamingGenerationService(
				this.getSettings,
				this.flashcardManager,
			);
			const result = await streamingService.generateStreaming(
				firstChunk.content,
				sourceFile,
				noteType,
			);
			return {
				...result,
				failedChunks: 0,
				totalChunks: 1,
				errors: [],
			};
		}

		return this.runChunkedGeneration(chunkingResult, sourceFile, noteType, app);
	}

	private async runChunkedGeneration(
		chunkingResult: ChunkingResult,
		sourceFile: TFile,
		noteType?: NoteType | null,
		app?: App,
	): Promise<ChunkedGenerationResult> {
		const { chunks, totalWords, estimatedTokens } = chunkingResult;

		if (app && totalWords > COST_CONFIRM_WORD_THRESHOLD) {
			const estimatedCost = estimatedTokens * 1.3 * COST_PER_TOKEN;
			const { confirm } = await import("@shared/ui/modals/ConfirmModal");
			const proceed = await confirm(app, {
				title: "Large Note Detected",
				message: `This note has ~${totalWords.toLocaleString()} words (~${estimatedTokens.toLocaleString()} tokens). It will be split into ${chunks.length} sections for better quality.\n\nEstimated cost: ~$${estimatedCost.toFixed(3)}`,
				confirmLabel: "Generate",
				cancelLabel: "Cancel",
			});
			if (!proceed) {
				throw new DOMException("User cancelled", "AbortError");
			}
		}

		const abortController = new AbortController();
		startStreaming(
			sourceFile.basename,
			sourceFile.path,
			abortController,
			chunks.length,
		);

		const settings = this.getSettings();
		const aiConfig = resolveAIClientConfig(settings);
		const customPrompt = settings.aiGenerationPrompt?.trim() || "";
		const systemPrompt = aiConfig.isPro
			? customPrompt
			: buildGenerationPrompt(settings, noteType);

		let totalCreated = 0;
		let totalDuplicates = 0;
		let failedChunks = 0;
		const errors: string[] = [];

		try {
			for (const chunk of chunks) {
				if (abortController.signal.aborted) break;

				updateChunkProgress(chunk.index, chunk.headingBreadcrumb || null);

				const formatPrefix = aiConfig.isPro
					? `${buildCardFormatSpec(noteType ?? FALLBACK_BASIC_NOTE_TYPE)}\n\n`
					: "";
				const userMessage = chunk.headingBreadcrumb
					? `${formatPrefix}[Context: This section is from "${chunk.headingBreadcrumb}" in the note "${sourceFile.basename}"]\n\n${chunk.content}`
					: `${formatPrefix}${chunk.content}`;

				try {
					const result = await this.generateSingleChunk(
						aiConfig,
						systemPrompt,
						userMessage,
						sourceFile,
						abortController.signal,
						noteType,
					);
					totalCreated += result.created;
					totalDuplicates += result.duplicates;
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						break;
					}
					failedChunks++;
					const msg = error instanceof Error ? error.message : String(error);
					errors.push(
						`Section ${chunk.index + 1}${chunk.headingBreadcrumb ? ` (${chunk.headingBreadcrumb})` : ""}: ${msg}`,
					);
					console.error(
						`[ChunkedGeneration] Chunk ${chunk.index} failed:`,
						error,
					);
				}
			}
		} finally {
			finishStreaming();
		}

		return {
			created: totalCreated,
			duplicates: totalDuplicates,
			failedChunks,
			totalChunks: chunks.length,
			errors,
		};
	}

	private async generateSingleChunk(
		aiConfig: AIClientConfig,
		systemPrompt: string,
		userMessage: string,
		sourceFile: TFile,
		signal: AbortSignal,
		noteType?: NoteType | null,
	): Promise<StreamingGenerationResult> {
		const client = new StreamingOpenRouterClient(aiConfig.apiKey, aiConfig.model, aiConfig.baseUrl);
		const getNoteType = (slug: string) =>
			this.flashcardManager.getNoteTypeBySlug?.(slug) ?? null;
		const parser = new IncrementalFlashcardParser(getNoteType);

		let createdCount = 0;
		let duplicateCount = 0;
		const throttledUpdatePartial = createThrottledPartialUpdater();
		const onCount = (created: number, dups: number) => {
			createdCount += created;
			duplicateCount += dups;
		};

		const messages = systemPrompt
			? [
					{ role: "system" as const, content: systemPrompt },
					{ role: "user" as const, content: userMessage },
				]
			: [{ role: "user" as const, content: userMessage }];

		const metadata = aiConfig.isPro
			? { call_context: "generation", note_type: noteType?.slug ?? "basic" }
			: undefined;

		const stream = client.chatStream(
			{
				messages,
				...(aiConfig.isPro ? {} : { temperature: aiConfig.temperature }),
				metadata,
			},
			signal,
		);

		for await (const chunk of stream) {
			const events = parser.feed(chunk.content);
			await processCardEvents(
				events,
				sourceFile,
				this.flashcardManager,
				throttledUpdatePartial,
				onCount,
			);
		}

		const finalEvents = parser.finish();
		await processCardEvents(
			finalEvents,
			sourceFile,
			this.flashcardManager,
			throttledUpdatePartial,
			onCount,
		);

		return { created: createdCount, duplicates: duplicateCount };
	}
}
