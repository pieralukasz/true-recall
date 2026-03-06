import {
	buildAutoPrompt,
	buildBlockPrompt,
} from "@features/ai/prompts/block-prompt-builder";
import {
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
import { chunkMarkdown, type ChunkingResult } from "./markdown-chunker";
import { processCardEvents } from "./process-card-events";
import {
	SOURCE_TRACKING_SUFFIX,
	StreamingGenerationService,
	type StreamingGenerationResult,
} from "./streaming-generation.service";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";
import {
	finishStreaming,
	startStreaming,
	updateChunkProgress,
	updatePartial,
} from "./streaming-state";

const CONCURRENCY_LIMIT = 3;
const COST_CONFIRM_WORD_THRESHOLD = 5000;
// Rough Gemini Flash ballpark: $0.15/1M input tokens + estimated output
const COST_PER_TOKEN = 0.15 / 1_000_000;

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
	): Promise<StreamingGenerationResult> {
		const chunkingResult = chunkMarkdown(content);

		if (chunkingResult.strategy === "single") {
			const streamingService = new StreamingGenerationService(
				this.getSettings,
				this.flashcardManager,
			);
			return streamingService.generateStreaming(
				chunkingResult.chunks[0]!.content,
				mode,
				sourceFile,
				noteType,
				allNoteTypes,
			);
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
	): Promise<StreamingGenerationResult> {
		const { chunks, totalWords, estimatedTokens } = chunkingResult;

		if (
			app &&
			totalWords > COST_CONFIRM_WORD_THRESHOLD
		) {
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
		let completedCount = 0;

		const tasks = chunks.map((chunk) => async () => {
			if (abortController.signal.aborted) return;

			updateChunkProgress(completedCount, chunk.headingBreadcrumb || null);

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
				if (
					error instanceof DOMException &&
					error.name === "AbortError"
				) {
					return;
				}
				// Try BYOK fallback on budget exceeded
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
						return;
					}
				}
				// Log but continue other chunks
				console.error(
					`[ChunkedGeneration] Chunk ${chunk.index} failed:`,
					error,
				);
			} finally {
				completedCount++;
			}
		});

		try {
			await withConcurrency(tasks, CONCURRENCY_LIMIT);
		} finally {
			finishStreaming();
		}

		return { created: totalCreated, duplicates: totalDuplicates };
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

		if (noteType?.slug) {
			const customKey = `notetype:${noteType.slug}`;
			const custom = (
				settings.aiFlashcardPrompts as Record<string, string | undefined>
			)?.[customKey];
			if (custom?.trim())
				return custom + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		const legacyCustom =
			settings.aiFlashcardPrompts?.[
				mode as keyof typeof settings.aiFlashcardPrompts
			];
		if (typeof legacyCustom === "string" && legacyCustom.trim()) {
			return legacyCustom + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		if (mode === "auto" && allNoteTypes && allNoteTypes.length > 0) {
			return (
				buildAutoPrompt(allNoteTypes) +
				SOURCE_TRACKING_SUFFIX +
				langSuffix
			);
		}

		if (noteType) {
			return (
				buildBlockPrompt(noteType) + SOURCE_TRACKING_SUFFIX + langSuffix
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
			SOURCE_TRACKING_SUFFIX +
			langSuffix
		);
	}
}

async function withConcurrency<T>(
	tasks: (() => Promise<T>)[],
	limit: number,
): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	let index = 0;

	async function worker(): Promise<void> {
		while (index < tasks.length) {
			const i = index++;
			results[i] = await tasks[i]!();
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
	);
	return results;
}
