import {
	buildByokPrompt,
	buildCardFormatSpec,
} from "./prompts/block-prompt-builder";
import type { IHttpClient } from "../interfaces/http-client";
import type { NoteType } from "../types/note.types";
import type { TrueRecallSettings } from "../types/settings.types";
import type { AIClientConfig } from "./ai-client-config";
import { resolveAIClientConfig } from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import {
	type CardEventFlashcardManager,
	processCardEvents,
	type SourceFileRef,
} from "./process-card-events";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";
import {
	createThrottledPartialUpdater,
	finishStreaming,
	type ScheduleCallback,
	startStreaming,
	streamingGeneration,
} from "./streaming-state";

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

export function buildGenerationPrompt(
	settings: TrueRecallSettings,
	noteType?: NoteType | null,
): string {
	return buildByokPrompt(
		noteType ?? FALLBACK_BASIC_NOTE_TYPE,
		settings.generationLanguage ?? "auto",
		settings.aiGenerationPrompt,
	);
}

export interface StreamingGenerationResult {
	created: number;
	duplicates: number;
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

	private async runStreamingGeneration(
		aiConfig: AIClientConfig,
		text: string,
		sourceFile: StreamingSourceFile,
		abortController: AbortController,
		noteType?: NoteType | null,
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
			: buildGenerationPrompt(settings, noteType);

		const metadata = aiConfig.isPro
			? { call_context: "generation", note_type: noteType?.slug ?? "basic" }
			: undefined;

		const userContent = aiConfig.isPro
			? `${buildCardFormatSpec(noteType ?? FALLBACK_BASIC_NOTE_TYPE)}\n\n${text}`
			: text;

		let createdCount = 0;
		let duplicateCount = 0;
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
			await processCardEvents(
				events,
				sourceFile,
				this.flashcardManager,
				throttledUpdatePartial,
				onCount,
				text,
			);
		}

		const finalEvents = parser.finish();
		await processCardEvents(
			finalEvents,
			sourceFile,
			this.flashcardManager,
			throttledUpdatePartial,
			onCount,
			text,
		);

		finishStreaming();
		return { created: createdCount, duplicates: duplicateCount };
	}
}
