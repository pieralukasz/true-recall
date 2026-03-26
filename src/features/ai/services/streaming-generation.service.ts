import { buildByokPrompt, buildCardFormatSpec } from "@features/ai/prompts/block-prompt-builder";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { TFile } from "obsidian";
import type { AIClientConfig } from "./ai-client-config";
import { resolveAIClientConfig } from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { processCardEvents } from "./process-card-events";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";
import {
	createThrottledPartialUpdater,
	finishStreaming,
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

export class StreamingGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private flashcardManager: FlashcardManager,
	) {}

	async generateStreaming(
		text: string,
		sourceFile: TFile,
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
		sourceFile: TFile,
		abortController: AbortController,
		noteType?: NoteType | null,
	): Promise<StreamingGenerationResult> {
		const client = new StreamingOpenRouterClient(aiConfig.apiKey, aiConfig.model, aiConfig.baseUrl);
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
		const throttledUpdatePartial = createThrottledPartialUpdater();
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

		finishStreaming();
		return { created: createdCount, duplicates: duplicateCount };
	}
}
