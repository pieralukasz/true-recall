import type { IHttpClient } from "../../interfaces/http-client";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { StreamingOpenRouterClient } from "../clients/streaming-openrouter-client";
import type { AIClientConfig } from "../config/ai-client-config";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import {
	buildPresetFormatSpec,
	buildPresetPrompt,
} from "../prompts/block-prompt-builder";
import {
	type ExistingCardContext,
	renderExistingCardsBlock,
} from "../prompts/existing-cards-block";
import {
	createThrottledPartialUpdater,
	finishStreaming,
	type ScheduleCallback,
	startStreaming,
} from "../state/streaming-state";
import { enqueueGeneration } from "./generation-queue";
import { resolveGenerationPresetAndNoteType } from "./preset-resolver";
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

export interface StreamingGenerationResult {
	created: number;
	duplicates: number;
	createdCardIds: string[];
	preset: GenerationPreset;
}

/** Minimal file reference for streaming generation (replaces Obsidian TFile). */
export interface StreamingSourceFile extends SourceFileRef {
	basename: string;
}

/** Minimal FlashcardManager interface for streaming generation. */
export interface StreamingFlashcardManager extends CardEventFlashcardManager {
	getNoteTypeBySlug?(slug: string): NoteType | null;
	getNoteTypeById(id: string): NoteType | null;
}

export interface StreamingGenerationOptions {
	existingCards?: ExistingCardContext[];
	/** Pre-rendered context text (source note content + related cards) to inject into the system prompt. */
	contextText?: string;
}

export class StreamingGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private flashcardManager: StreamingFlashcardManager,
		private httpClient: IHttpClient,
		private schedule?: ScheduleCallback,
	) {}

	async generate(
		text: string,
		sourceFile: StreamingSourceFile,
		presetId: string,
		options?: StreamingGenerationOptions,
	): Promise<StreamingGenerationResult> {
		return enqueueGeneration(() =>
			this.generateQueued(text, sourceFile, presetId, options),
		);
	}

	private async generateQueued(
		text: string,
		sourceFile: StreamingSourceFile,
		presetId: string,
		options?: StreamingGenerationOptions,
	): Promise<StreamingGenerationResult> {
		const settings = this.getSettings();
		const { preset, noteType } = resolveGenerationPresetAndNoteType(
			settings,
			this.flashcardManager,
			presetId,
		);

		if (preset.requiresPro && !settings.proKey) {
			throw new Error(
				`Preset "${preset.name}" requires True Recall Pro. Upgrade or pick a different preset.`,
			);
		}

		const aiConfig = resolveAIClientConfig(settings, "generation");
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
				options,
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
		options?: StreamingGenerationOptions,
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

		// Prompts containing the {{EXISTING_CARDS}} placeholder are authoritative
		// full system prompts (e.g. built-in Pro preset) — use verbatim and send
		// the format spec as the user message so format instructions still reach
		// the model. Otherwise wrap the user's prompt in the format spec derived
		// from the note type and send the raw text as the user message.
		const useRawPrompt = preset.prompt.includes("{{EXISTING_CARDS}}");
		const rawSystemPrompt = useRawPrompt
			? preset.prompt
			: buildPresetPrompt(preset, noteType);
		const existingCardsBlock = renderExistingCardsBlock(
			options?.existingCards ?? [],
		);
		let systemPrompt = rawSystemPrompt.replace(
			"{{EXISTING_CARDS}}",
			existingCardsBlock,
		);
		if (options?.contextText?.trim()) {
			systemPrompt = `${options.contextText.trim()}\n\n${systemPrompt}`;
		}

		const metadata = aiConfig.hasProTier
			? {
					call_context: "generation",
					note_type: noteType.slug ?? "basic",
					preset_id: preset.id,
				}
			: undefined;

		const userContent = useRawPrompt
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
				...(aiConfig.hasProTier ? {} : { temperature: aiConfig.temperature }),
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
			preset,
		};
	}
}
