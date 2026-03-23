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
import type { TFile } from "obsidian";
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

export const SOURCE_TRACKING_SUFFIX = `

SOURCE TRACKING (MANDATORY):
After each card's fields, on a new line, add: <!-- source: [exact verbatim quote from the input text] -->
The quote must be EXACTLY copied from the input — same words, same punctuation. Keep it to the specific sentence(s) for that flashcard.`;

const FALLBACK_BASIC_NOTE_TYPE = {
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
	mode: GenerationMode,
	noteType?: NoteType | null,
	allNoteTypes?: NoteType[],
): string {
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
		buildBlockPrompt(FALLBACK_BASIC_NOTE_TYPE) +
		densitySuffix +
		SOURCE_TRACKING_SUFFIX +
		langSuffix
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
				undefined,
				text,
				mode,
				sourceFile,
				abortController,
				noteType,
				allNoteTypes,
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
		const systemPrompt = buildGenerationPrompt(
			this.getSettings(),
			mode,
			noteType,
			allNoteTypes,
		);

		let createdCount = 0;
		let duplicateCount = 0;
		const throttledUpdatePartial = createThrottledPartialUpdater();
		const onCount = (created: number, dups: number) => {
			createdCount += created;
			duplicateCount += dups;
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
