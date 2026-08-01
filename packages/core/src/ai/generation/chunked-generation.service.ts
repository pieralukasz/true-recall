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
import type { ExistingCardContext } from "../prompts/existing-cards-block";
import {
	buildGenerationPrompt,
	type GenerationPromptMetadata,
} from "../prompts/generation-request";
import {
	createThrottledPartialUpdater,
	finishStreaming,
	type ScheduleCallback,
	startStreaming,
	updateChunkProgress,
} from "../state/streaming-state";
import { enqueueGeneration } from "./generation-queue";
import { resolveGenerationTarget } from "./preset-resolver";
import { processCardEvents } from "./process-card-events";
import {
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
		presetId: string,
		options?: { existingCards?: ExistingCardContext[]; contextText?: string },
		confirmLargeNote?: ConfirmLargeNote,
	): Promise<ChunkedGenerationResult> {
		const settings = this.getSettings();
		const { preset, noteType } = resolveGenerationTarget(
			settings,
			this.flashcardManager,
			presetId,
		);

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
			const result = await streamingService.generate(
				firstChunk.content,
				sourceFile,
				presetId,
				options,
			);
			return {
				...result,
				failedChunks: 0,
				totalChunks: 1,
				errors: [],
			};
		}

		return enqueueGeneration(() =>
			this.runChunkedGeneration(
				chunkingResult,
				sourceFile,
				preset,
				noteType,
				options,
				confirmLargeNote,
			),
		);
	}

	private async runChunkedGeneration(
		chunkingResult: ChunkingResult,
		sourceFile: StreamingSourceFile,
		preset: GenerationPreset,
		noteType: NoteType,
		options?: {
			existingCards?: ExistingCardContext[];
			contextText?: string;
		},
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
		const aiConfig = resolveAIClientConfig(settings, "generation");

		let totalCreated = 0;
		let totalDuplicates = 0;
		let failedChunks = 0;
		const errors: string[] = [];
		const allCreatedCardIds: string[] = [];

		try {
			for (const chunk of chunks) {
				if (abortController.signal.aborted) break;

				updateChunkProgress(chunk.index, chunk.headingBreadcrumb || null);

				const { systemPrompt, userContent, metadata } = buildGenerationPrompt({
					preset,
					noteType,
					text: chunk.content,
					existingCards: options?.existingCards,
					contextText: options?.contextText,
					hasProTier: aiConfig.hasProTier,
					chunk: {
						headingBreadcrumb: chunk.headingBreadcrumb,
						sourceName: sourceFile.basename,
					},
				});

				try {
					const result = await this.generateSingleChunk(
						aiConfig,
						systemPrompt,
						userContent,
						metadata,
						sourceFile,
						abortController.signal,
						preset,
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
			preset,
			failedChunks,
			totalChunks: chunks.length,
			errors,
		};
	}

	private async generateSingleChunk(
		aiConfig: AIClientConfig,
		systemPrompt: string,
		userMessage: string,
		metadata: GenerationPromptMetadata | undefined,
		sourceFile: StreamingSourceFile,
		signal: AbortSignal,
		preset: GenerationPreset,
		chunkContent?: string,
	): Promise<StreamingGenerationResult> {
		const client = new StreamingOpenRouterClient(
			aiConfig.apiKey,
			aiConfig.model,
			this.httpClient,
			aiConfig.baseUrl,
			undefined,
			{ providerType: aiConfig.providerType },
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

		const stream = client.chatStream(
			{
				messages,
				...(aiConfig.hasProTier ? {} : { temperature: aiConfig.temperature }),
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
