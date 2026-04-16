import type { IHttpClient } from "../../interfaces/http-client";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { StreamingOpenRouterClient } from "../clients/streaming-openrouter-client";
import type { AIClientConfig } from "../config/ai-client-config";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import {
	type ChunkingResult,
	chunkMarkdown,
} from "../parsing/markdown-chunker";
import { buildCardFormatSpec } from "../prompts/block-prompt-builder";
import {
	createThrottledPartialUpdater,
	finishStreaming,
	type ScheduleCallback,
	startStreaming,
	updateChunkProgress,
} from "../state/streaming-state";
import { processCardEvents } from "./process-card-events";
import {
	buildGenerationPrompt,
	FALLBACK_BASIC_NOTE_TYPE,
	type StreamingFlashcardManager,
	type StreamingGenerationResult,
	StreamingGenerationService,
	type StreamingSourceFile,
} from "./streaming-generation.service";

const COST_CONFIRM_WORD_THRESHOLD = 5000;
const COST_PER_TOKEN = 0.15 / 1_000_000;

export interface ChunkedGenerationResult extends StreamingGenerationResult {
	failedChunks: number;
	totalChunks: number;
	errors: string[];
}

/**
 * Platform-injectable confirmation dialog.
 * In Obsidian, wire this to the ConfirmModal.
 * Return `true` to proceed, `false` to cancel.
 */
export type ConfirmLargeNote = (params: {
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
}) => Promise<boolean>;

export class ChunkedGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private flashcardManager: StreamingFlashcardManager,
		private httpClient: IHttpClient,
		private schedule?: ScheduleCallback,
	) {}

	async generateFromNote(
		content: string,
		sourceFile: StreamingSourceFile,
		noteType?: NoteType | null,
		confirmLargeNote?: ConfirmLargeNote,
	): Promise<ChunkedGenerationResult> {
		const chunkingResult = chunkMarkdown(content);

		if (chunkingResult.strategy === "single") {
			const firstChunk = chunkingResult.chunks[0];
			if (!firstChunk) throw new Error("Expected at least one chunk");
			const streamingService = new StreamingGenerationService(
				this.getSettings,
				this.flashcardManager,
				this.httpClient,
				this.schedule,
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

		return this.runChunkedGeneration(
			chunkingResult,
			sourceFile,
			noteType,
			confirmLargeNote,
		);
	}

	private async runChunkedGeneration(
		chunkingResult: ChunkingResult,
		sourceFile: StreamingSourceFile,
		noteType?: NoteType | null,
		confirmLargeNote?: ConfirmLargeNote,
	): Promise<ChunkedGenerationResult> {
		const { chunks, totalWords, estimatedTokens } = chunkingResult;

		if (confirmLargeNote && totalWords > COST_CONFIRM_WORD_THRESHOLD) {
			const estimatedCost = estimatedTokens * 1.3 * COST_PER_TOKEN;
			const proceed = await confirmLargeNote({
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
		const _legacyPlaceholderPreset: GenerationPreset =
			settings.generationPresets?.[0] ??
			({
				id: "_legacy",
				name: "Legacy",
				noteTypeId: (noteType ?? FALLBACK_BASIC_NOTE_TYPE).id,
				fields: {},
				isPinned: false,
				isDefault: false,
				createdAt: 0,
				updatedAt: 0,
			} as GenerationPreset);
		const aiConfig = resolveAIClientConfig(settings);
		const customPrompt = settings.aiGenerationPrompt?.trim() || "";
		const systemPrompt = aiConfig.isPro
			? customPrompt
			: buildGenerationPrompt(settings, noteType);

		let totalCreated = 0;
		let totalDuplicates = 0;
		let failedChunks = 0;
		const errors: string[] = [];
		const allCreatedCardIds: string[] = [];

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
						_legacyPlaceholderPreset,
						noteType,
						chunk.content,
					);
					totalCreated += result.created;
					totalDuplicates += result.duplicates;
					allCreatedCardIds.push(...result.createdCardIds);
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
			createdCardIds: allCreatedCardIds,
			preset: _legacyPlaceholderPreset,
			failedChunks,
			totalChunks: chunks.length,
			errors,
		};
	}

	private async generateSingleChunk(
		aiConfig: AIClientConfig,
		systemPrompt: string,
		userMessage: string,
		sourceFile: StreamingSourceFile,
		signal: AbortSignal,
		preset: GenerationPreset,
		noteType?: NoteType | null,
		chunkContent?: string,
	): Promise<StreamingGenerationResult> {
		const client = new StreamingOpenRouterClient(
			aiConfig.apiKey,
			aiConfig.model,
			this.httpClient,
			aiConfig.baseUrl,
		);
		const getNoteType = (slug: string) =>
			this.flashcardManager.getNoteTypeBySlug?.(slug) ?? null;
		const parser = new IncrementalFlashcardParser(getNoteType);

		let createdCount = 0;
		let duplicateCount = 0;
		const createdCardIds: string[] = [];
		const throttledUpdatePartial = createThrottledPartialUpdater(this.schedule);
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
			const ids = await processCardEvents(
				events,
				sourceFile,
				this.flashcardManager,
				throttledUpdatePartial,
				onCount,
				chunkContent,
			);
			createdCardIds.push(...ids);
		}

		const finalEvents = parser.finish();
		const finalIds = await processCardEvents(
			finalEvents,
			sourceFile,
			this.flashcardManager,
			throttledUpdatePartial,
			onCount,
			chunkContent,
		);
		createdCardIds.push(...finalIds);

		return {
			created: createdCount,
			duplicates: duplicateCount,
			createdCardIds,
			preset,
		};
	}
}
