import type { IHttpClient } from "../../interfaces/http-client";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { StreamingOpenRouterClient } from "../clients/streaming-openrouter-client";
import type { AIClientConfig } from "../config/ai-client-config";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import {
	buildByokPrompt,
	buildCardFormatSpec,
	buildLanguageByokPrompt,
	buildPresetFormatSpec,
	buildPresetPrompt,
} from "../prompts/block-prompt-builder";
import {
	createThrottledPartialUpdater,
	finishStreaming,
	type ScheduleCallback,
	startStreaming,
	streamingGeneration,
} from "../state/streaming-state";
import {
	type CardEventFlashcardManager,
	processCardEvents,
	type SourceFileRef,
} from "./process-card-events";

export const FALLBACK_BASIC_NOTE_TYPE = {
	id: "builtin-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
} as NoteType;

export interface LanguageContext {
	sourceLanguage: string;
	targetLanguage: string;
}

export function buildGenerationPrompt(
	settings: TrueRecallSettings,
	noteType?: NoteType | null,
	languageContext?: LanguageContext | null,
): string {
	if (languageContext?.sourceLanguage && languageContext?.targetLanguage) {
		return buildLanguageByokPrompt(
			noteType ?? FALLBACK_BASIC_NOTE_TYPE,
			languageContext.sourceLanguage,
			languageContext.targetLanguage,
			settings.aiGenerationPrompt,
		);
	}

	return buildByokPrompt(
		noteType ?? FALLBACK_BASIC_NOTE_TYPE,
		settings.generationLanguage ?? "auto",
		settings.aiGenerationPrompt,
	);
}

export interface StreamingGenerationResult {
	created: number;
	duplicates: number;
	createdCardIds: string[];
}

/** Minimal file reference for streaming generation (replaces Obsidian TFile). */
export interface StreamingSourceFile extends SourceFileRef {
	basename: string;
}

/** Minimal FlashcardManager interface for streaming generation. */
export interface StreamingFlashcardManager extends CardEventFlashcardManager {
	getNoteTypeBySlug?(slug: string): NoteType | null;
}

export class StreamingGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private flashcardManager: StreamingFlashcardManager,
		private httpClient: IHttpClient,
		private schedule?: ScheduleCallback,
	) {}

	async generateStreaming(
		text: string,
		sourceFile: StreamingSourceFile,
		noteType?: NoteType | null,
		languageContext?: LanguageContext | null,
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
				aiConfig,
				text,
				sourceFile,
				abortController,
				noteType ?? null,
				languageContext ?? null,
			);
		} catch (error) {
			if (abortController.signal.aborted) {
				finishStreaming();
			} else {
				finishStreaming(error instanceof Error ? error.message : String(error));
			}
			throw error;
		}
	}

	async generateWithPreset(
		text: string,
		sourceFile: StreamingSourceFile,
		preset: GenerationPreset,
		noteType: NoteType,
	): Promise<StreamingGenerationResult> {
		if (streamingGeneration.value.isGenerating) {
			throw new Error("Generation already in progress");
		}

		const settings = this.getSettings();
		const aiConfig = resolveAIClientConfig(settings);

		const abortController = new AbortController();
		startStreaming(sourceFile.basename, sourceFile.path, abortController);

		try {
			return await this.runPresetGeneration(
				aiConfig,
				text,
				sourceFile,
				abortController,
				preset,
				noteType,
			);
		} catch (error) {
			if (abortController.signal.aborted) {
				finishStreaming();
			} else {
				finishStreaming(error instanceof Error ? error.message : String(error));
			}
			throw error;
		}
	}

	private async runPresetGeneration(
		aiConfig: AIClientConfig,
		text: string,
		sourceFile: StreamingSourceFile,
		abortController: AbortController,
		preset: GenerationPreset,
		noteType: NoteType,
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

		const systemPrompt = aiConfig.isPro
			? preset.customPrompt?.trim() || ""
			: buildPresetPrompt(preset, noteType);

		const metadata = aiConfig.isPro
			? { call_context: "generation", note_type: noteType.slug ?? "basic" }
			: undefined;

		const userContent = aiConfig.isPro
			? `${buildPresetFormatSpec(preset, noteType)}\n\n${text}`
			: text;

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
					{ role: "user" as const, content: userContent },
				]
			: [{ role: "user" as const, content: userContent }];

		const stream = client.chatStream(
			{
				messages,
				...(aiConfig.isPro ? {} : { temperature: aiConfig.temperature }),
				metadata,
			},
			abortController.signal,
		);

		for await (const chunk of stream) {
			const events = parser.feed(chunk.content);
			const ids = await processCardEvents(
				events,
				sourceFile,
				this.flashcardManager,
				throttledUpdatePartial,
				onCount,
				text,
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
			text,
		);
		createdCardIds.push(...finalIds);

		finishStreaming();
		return {
			created: createdCount,
			duplicates: duplicateCount,
			createdCardIds,
		};
	}

	private async runStreamingGeneration(
		aiConfig: AIClientConfig,
		text: string,
		sourceFile: StreamingSourceFile,
		abortController: AbortController,
		noteType: NoteType | null,
		languageContext: LanguageContext | null,
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

		const settings = this.getSettings();
		const customPrompt = settings.aiGenerationPrompt?.trim() || "";
		const systemPrompt = aiConfig.isPro
			? customPrompt
			: buildGenerationPrompt(settings, noteType, languageContext);

		const metadata = aiConfig.isPro
			? {
					call_context: "generation",
					note_type: noteType?.slug ?? "basic",
					...(languageContext?.sourceLanguage
						? { source_language: languageContext.sourceLanguage }
						: {}),
					...(languageContext?.targetLanguage
						? { target_language: languageContext.targetLanguage }
						: {}),
				}
			: undefined;

		const userContent = aiConfig.isPro
			? `${buildCardFormatSpec(noteType ?? FALLBACK_BASIC_NOTE_TYPE)}\n\n${text}`
			: text;

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
					{ role: "user" as const, content: userContent },
				]
			: [{ role: "user" as const, content: userContent }];

		const stream = client.chatStream(
			{
				messages,
				...(aiConfig.isPro ? {} : { temperature: aiConfig.temperature }),
				metadata,
			},
			abortController.signal,
		);

		for await (const chunk of stream) {
			const events = parser.feed(chunk.content);
			const ids = await processCardEvents(
				events,
				sourceFile,
				this.flashcardManager,
				throttledUpdatePartial,
				onCount,
				text,
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
			text,
		);
		createdCardIds.push(...finalIds);

		finishStreaming();
		return {
			created: createdCount,
			duplicates: duplicateCount,
			createdCardIds,
		};
	}
}
