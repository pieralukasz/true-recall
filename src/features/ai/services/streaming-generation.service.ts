import {
	DEFAULT_PROMPTS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { TFile } from "obsidian";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import {
	addStreamedCard,
	finishStreaming,
	startStreaming,
	streamingGeneration,
	updatePartial,
} from "./streaming-state";
import { StreamingOpenRouterClient } from "./streaming-openrouter-client";

const SOURCE_TRACKING_SUFFIX = `

SOURCE TRACKING (MANDATORY):
After each answer, on a new line, add: <!-- source: [exact verbatim quote from the input text] -->
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

	async generateStreaming(
		text: string,
		mode: GenerationMode,
		sourceFile: TFile,
	): Promise<StreamingGenerationResult> {
		if (streamingGeneration.value.isGenerating) {
			throw new Error("Generation already in progress");
		}

		const settings = this.getSettings();
		if (!settings.openRouterApiKey) {
			throw new Error("OpenRouter API key is not configured");
		}

		const abortController = new AbortController();
		startStreaming(sourceFile.basename, sourceFile.path, abortController);

		const client = new StreamingOpenRouterClient(
			settings.openRouterApiKey,
			settings.aiModel,
		);
		const parser = new IncrementalFlashcardParser();
		const systemPrompt = this.getPromptForMode(mode);

		let createdCount = 0;
		let duplicateCount = 0;
		let pendingPartialUpdate: (() => void) | null = null;

		const throttledUpdatePartial = (
			question: string | null,
			answer: string | null,
		) => {
			if (pendingPartialUpdate) return;
			pendingPartialUpdate = () => {
				updatePartial(question, answer);
				pendingPartialUpdate = null;
			};
			requestAnimationFrame(() => {
				pendingPartialUpdate?.();
			});
		};

		try {
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

			// Finalize remaining content
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
		} catch (error) {
			if (abortController.signal.aborted) {
				finishStreaming();
			} else {
				finishStreaming(
					error instanceof Error ? error.message : String(error),
				);
			}
			throw error;
		}
	}

	private async processEvents(
		events: ReturnType<IncrementalFlashcardParser["feed"]>,
		sourceFile: TFile,
		onPartial: (q: string | null, a: string | null) => void,
		onCount: (created: number, dups: number) => void,
	): Promise<void> {
		for (const event of events) {
			if (event.type === "card_complete" && event.cards) {
				for (const card of event.cards) {
					try {
						const batchResult =
							await this.flashcardManager.saveFlashcardsToSql(
								sourceFile,
								[card],
								"ai",
							);
						if (batchResult.created.length > 0) {
							onCount(1, 0);
							addStreamedCard(card);
						} else {
							onCount(0, 1);
						}
					} catch {
						onCount(0, 1);
					}
				}
			} else if (event.type === "partial_update") {
				onPartial(
					event.partialQuestion ?? null,
					event.partialAnswer ?? null,
				);
			}
		}
	}

	private getPromptForMode(mode: GenerationMode): string {
		const settings = this.getSettings();
		const customPrompt = settings.aiFlashcardPrompts?.[mode];
		const basePrompt = customPrompt?.trim() || DEFAULT_PROMPTS[mode];
		return basePrompt + SOURCE_TRACKING_SUFFIX;
	}
}
