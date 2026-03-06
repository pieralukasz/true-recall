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
import { Notice, type TFile } from "obsidian";
import {
	getBYOKFallbackConfig,
	resolveAIClientConfig,
} from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { AIRequestError } from "./openrouter-client";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";
import { processCardEvents } from "./process-card-events";
import {
	finishStreaming,
	startStreaming,
	streamingGeneration,
	updatePartial,
} from "./streaming-state";

export const SOURCE_TRACKING_SUFFIX = `

SOURCE TRACKING (MANDATORY):
After each card's fields, on a new line, add: <!-- source: [exact verbatim quote from the input text] -->
The quote must be EXACTLY copied from the input — same words, same punctuation. Keep it to the specific sentence(s) for that flashcard.`;

export interface StreamingGenerationResult {
	created: number;
	duplicates: number;
}

export class StreamingGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private flashcardManager: FlashcardManager,
	) {}

	/**
	 * Generate flashcards with a specific NoteType.
	 * For "auto" mode, pass noteType=null and provide allNoteTypes.
	 */
	async generateStreaming(
		text: string,
		mode: GenerationMode,
		sourceFile: TFile,
		noteType?: NoteType | null,
		allNoteTypes?: NoteType[],
	): Promise<StreamingGenerationResult> {
		if (streamingGeneration.value.isGenerating) {
			throw new Error("Generation already in progress");
		}

		const settings = this.getSettings();
		const aiConfig = resolveAIClientConfig(settings);

		const abortController = new AbortController();
		startStreaming(sourceFile.basename, sourceFile.path, abortController);

		try {
			return await this.runStreamingGeneration(
				aiConfig.apiKey,
				aiConfig.model,
				aiConfig.proxyUrl,
				aiConfig.userId,
				text,
				mode,
				sourceFile,
				abortController,
				noteType,
				allNoteTypes,
			);
		} catch (error) {
			if (error instanceof AIRequestError && error.isBudgetExceeded) {
				const fallback = getBYOKFallbackConfig(settings);
				if (fallback) {
					new Notice(
						"Subscription budget exceeded. Falling back to your OpenRouter key.",
					);
					return await this.runStreamingGeneration(
						fallback.apiKey,
						fallback.model,
						fallback.proxyUrl,
						undefined,
						text,
						mode,
						sourceFile,
						abortController,
						noteType,
						allNoteTypes,
					);
				}
				new Notice(
					"Budget exceeded. Top up at truerecall.app/dashboard, or add your own OpenRouter API key in settings.",
				);
			}

			if (abortController.signal.aborted) {
				finishStreaming();
			} else {
				finishStreaming(error instanceof Error ? error.message : String(error));
			}
			throw error;
		}
	}

	private async runStreamingGeneration(
		apiKey: string,
		model: string,
		proxyUrl: string | undefined,
		userId: string | undefined,
		text: string,
		mode: GenerationMode,
		sourceFile: TFile,
		abortController: AbortController,
		noteType?: NoteType | null,
		allNoteTypes?: NoteType[],
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
		const systemPrompt = this.getPrompt(mode, noteType, allNoteTypes);

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

		const stream = client.chatStream(
			{
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: text },
				],
				temperature: 0.7,
			},
			abortController.signal,
		);

		for await (const chunk of stream) {
			const events = parser.feed(chunk.content);
			await this.processEvents(
				events,
				sourceFile,
				throttledUpdatePartial,
				(created, dups) => {
					createdCount += created;
					duplicateCount += dups;
				},
			);
		}

		const finalEvents = parser.finish();
		await this.processEvents(
			finalEvents,
			sourceFile,
			throttledUpdatePartial,
			(created, dups) => {
				createdCount += created;
				duplicateCount += dups;
			},
		);

		finishStreaming();
		return { created: createdCount, duplicates: duplicateCount };
	}

	private async processEvents(
		events: ReturnType<IncrementalFlashcardParser["feed"]>,
		sourceFile: TFile,
		onPartial: (q: string | null, a: string | null) => void,
		onCount: (created: number, dups: number) => void,
	): Promise<void> {
		return processCardEvents(
			events,
			sourceFile,
			this.flashcardManager,
			onPartial,
			onCount,
		);
	}

	private getPrompt(
		mode: GenerationMode,
		noteType?: NoteType | null,
		allNoteTypes?: NoteType[],
	): string {
		const settings = this.getSettings();
		const langSuffix = buildLanguageSuffix(
			settings.generationLanguage ?? "auto",
		);

		// Check for custom prompt override by slug
		if (noteType?.slug) {
			const customKey = `notetype:${noteType.slug}`;
			const custom = (
				settings.aiFlashcardPrompts as Record<string, string | undefined>
			)?.[customKey];
			if (custom?.trim()) return custom + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		// Check for legacy mode-based custom prompt
		const legacyCustom =
			settings.aiFlashcardPrompts?.[
				mode as keyof typeof settings.aiFlashcardPrompts
			];
		if (typeof legacyCustom === "string" && legacyCustom.trim()) {
			return legacyCustom + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		// Auto mode — list all NoteTypes
		if (mode === "auto" && allNoteTypes && allNoteTypes.length > 0) {
			return (
				buildAutoPrompt(allNoteTypes) + SOURCE_TRACKING_SUFFIX + langSuffix
			);
		}

		// Specific NoteType
		if (noteType) {
			return buildBlockPrompt(noteType) + SOURCE_TRACKING_SUFFIX + langSuffix;
		}

		// Fallback: use block format with builtin Basic type
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
