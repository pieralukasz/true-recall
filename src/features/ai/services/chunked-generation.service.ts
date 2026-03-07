import {
	buildAutoPrompt,
	buildBlockPrompt,
} from "@features/ai/prompts/block-prompt-builder";
import {
	buildDensitySuffix,
	buildLanguageSuffix,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { App, TFile } from "obsidian";
import {
	getBYOKFallbackConfig,
	resolveAIClientConfig,
} from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { type ChunkingResult, chunkMarkdown } from "./markdown-chunker";
import { processCardEvents } from "./process-card-events";
import {
	SOURCE_TRACKING_SUFFIX,
	type StreamingGenerationResult,
	StreamingGenerationService,
} from "./streaming-generation.service";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";
import {
	finishStreaming,
	startStreaming,
	updateChunkProgress,
	updatePartial,
} from "./streaming-state";

const COST_CONFIRM_WORD_THRESHOLD = 5000;
// Rough Gemini Flash ballpark: $0.15/1M input tokens + estimated output
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
		mode: GenerationMode,
		sourceFile: TFile,
		noteType?: NoteType | null,
		allNoteTypes?: NoteType[],
		app?: App,
	): Promise<ChunkedGenerationResult> {
		const chunkingResult = chunkMarkdown(content);

		if (chunkingResult.strategy === "single") {
			const streamingService = new StreamingGenerationService(
				this.getSettings,
				this.flashcardManager,
			);
			const result = await streamingService.generateStreaming(
				chunkingResult.chunks[0]?.content,
				mode,
				sourceFile,
				noteType,
				allNoteTypes,
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
			mode,
			sourceFile,
			noteType,
			allNoteTypes,
			app,
		);
	}

	private async runChunkedGeneration(
		chunkingResult: ChunkingResult,
		mode: GenerationMode,
		sourceFile: TFile,
		noteType?: NoteType | null,
		allNoteTypes?: NoteType[],
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

		const systemPrompt = this.buildPrompt(mode, noteType, allNoteTypes);
		const settings = this.getSettings();
		const aiConfig = resolveAIClientConfig(settings);

		let totalCreated = 0;
		let totalDuplicates = 0;
		let failedChunks = 0;
		const errors: string[] = [];

		try {
			for (const chunk of chunks) {
				if (abortController.signal.aborted) break;

				updateChunkProgress(chunk.index, chunk.headingBreadcrumb || null);

				const userMessage = chunk.headingBreadcrumb
					? `[Context: This section is from "${chunk.headingBreadcrumb}" in the note "${sourceFile.basename}"]\n\n${chunk.content}`
					: chunk.content;

				try {
					const result = await this.generateSingleChunk(
						aiConfig.apiKey,
						aiConfig.model,
						aiConfig.proxyUrl,
						aiConfig.userId,
						systemPrompt,
						userMessage,
						sourceFile,
						abortController.signal,
					);
					totalCreated += result.created;
					totalDuplicates += result.duplicates;
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						break;
					}
					// Try BYOK fallback on budget exceeded
					try {
						const { AIRequestError } = await import("./openrouter-client");
						if (error instanceof AIRequestError && error.isBudgetExceeded) {
							const fallback = getBYOKFallbackConfig(settings);
							if (fallback) {
								const result = await this.generateSingleChunk(
									fallback.apiKey,
									fallback.model,
									fallback.proxyUrl,
									undefined,
									systemPrompt,
									userMessage,
									sourceFile,
									abortController.signal,
								);
								totalCreated += result.created;
								totalDuplicates += result.duplicates;
								continue;
							}
						}
					} catch {
						// Fallback also failed — fall through to error tracking
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
		apiKey: string,
		model: string,
		proxyUrl: string | undefined,
		userId: string | undefined,
		systemPrompt: string,
		userMessage: string,
		sourceFile: TFile,
		signal: AbortSignal,
	): Promise<StreamingGenerationResult> {
		const client = new StreamingOpenRouterClient(
			apiKey,
			model,
			proxyUrl,
			userId,
		);
		const getNoteType = (slug: string) =>
			this.flashcardManager.getNoteTypeBySlug?.(slug) ?? null;
		const parser = new IncrementalFlashcardParser(getNoteType);

		let createdCount = 0;
		let duplicateCount = 0;
		let pendingQuestion: string | null = null;
		let pendingAnswer: string | null = null;
		let rafScheduled = false;

		const throttledUpdatePartial = (
			question: string | null,
			answer: string | null,
		) => {
			pendingQuestion = question;
			pendingAnswer = answer;
			if (!rafScheduled) {
				rafScheduled = true;
				requestAnimationFrame(() => {
					updatePartial(pendingQuestion, pendingAnswer);
					rafScheduled = false;
				});
			}
		};

		const onCount = (created: number, dups: number) => {
			createdCount += created;
			duplicateCount += dups;
		};

		const stream = client.chatStream(
			{
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userMessage },
				],
				temperature: 0.7,
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

	private buildPrompt(
		mode: GenerationMode,
		noteType?: NoteType | null,
		allNoteTypes?: NoteType[],
	): string {
		const settings = this.getSettings();
		const langSuffix = buildLanguageSuffix(
			settings.generationLanguage ?? "auto",
		);
		const densitySuffix = buildDensitySuffix(
			settings.generationDensity ?? "balanced",
		);

		if (noteType?.slug) {
			const customKey = `notetype:${noteType.slug}`;
			const custom = (
				settings.aiFlashcardPrompts as Record<string, string | undefined>
			)?.[customKey];
			if (custom?.trim())
				return custom + densitySuffix + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		const legacyCustom =
			settings.aiFlashcardPrompts?.[
				mode as keyof typeof settings.aiFlashcardPrompts
			];
		if (typeof legacyCustom === "string" && legacyCustom.trim()) {
			return legacyCustom + densitySuffix + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		if (mode === "auto" && allNoteTypes && allNoteTypes.length > 0) {
			return (
				buildAutoPrompt(allNoteTypes) +
				densitySuffix +
				SOURCE_TRACKING_SUFFIX +
				langSuffix
			);
		}

		if (noteType) {
			return (
				buildBlockPrompt(noteType) +
				densitySuffix +
				SOURCE_TRACKING_SUFFIX +
				langSuffix
			);
		}

		return (
			buildBlockPrompt({
				id: "builtin-basic",
				name: "Basic",
				type: 0,
				fields: ["Front", "Back"],
				templates: [],
				css: "",
				isBuiltin: true,
				slug: "basic",
			} as NoteType) +
			densitySuffix +
			SOURCE_TRACKING_SUFFIX +
			langSuffix
		);
	}
}
