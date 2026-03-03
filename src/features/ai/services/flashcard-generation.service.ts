import {
	DEFAULT_PROMPTS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { FlashcardItem } from "@shared/types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { Notice } from "obsidian";
import { getBYOKFallbackConfig, resolveAIClientConfig } from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { AIRequestError, OpenRouterClient } from "./openrouter-client";

// Appended to all prompts (including custom) so per-card source tracking works
const SOURCE_TRACKING_SUFFIX = `

SOURCE TRACKING (MANDATORY):
After each answer, on a new line, add: <!-- source: [exact verbatim quote from the input text] -->
The quote must be EXACTLY copied from the input — same words, same punctuation. Keep it to the specific sentence(s) for that flashcard.`;

export interface GenerationResult {
	flashcards: FlashcardItem[];
	mode: GenerationMode;
}

export class FlashcardGenerationService {
	constructor(private getSettings: () => TrueRecallSettings) {}

	async generate(
		selectedText: string,
		mode: GenerationMode,
	): Promise<GenerationResult> {
		const settings = this.getSettings();
		const config = resolveAIClientConfig(settings);

		const client = new OpenRouterClient(
			config.apiKey,
			config.model,
			config.proxyUrl,
			config.userId,
		);
		const systemPrompt = this.getPromptForMode(mode);

		const request = {
			messages: [
				{ role: "system" as const, content: systemPrompt },
				{ role: "user" as const, content: selectedText },
			],
			temperature: 0.7,
		};

		try {
			const response = await client.chat(request);
			const responseText = response.choices[0]?.message?.content ?? "";
			const flashcards = this.parseResponse(responseText);
			return { flashcards, mode };
		} catch (error) {
			if (error instanceof AIRequestError && error.isBudgetExceeded) {
				const fallback = getBYOKFallbackConfig(settings);
				if (fallback) {
					new Notice("Subscription budget exceeded. Falling back to your OpenRouter key.");
					const fallbackClient = new OpenRouterClient(
						fallback.apiKey,
						fallback.model,
						fallback.proxyUrl,
						undefined,
					);
					const response = await fallbackClient.chat(request);
					const responseText = response.choices[0]?.message?.content ?? "";
					const flashcards = this.parseResponse(responseText);
					return { flashcards, mode };
				}
				new Notice("Token budget exceeded. Top up at truerecall.app or add your own OpenRouter API key.");
			}
			throw error;
		}
	}

	private parseResponse(text: string): FlashcardItem[] {
		const parser = new IncrementalFlashcardParser();
		parser.feed(text);
		return parser.finish().flatMap((e) => e.cards ?? []);
	}

	private getPromptForMode(mode: GenerationMode): string {
		const settings = this.getSettings();
		const customPrompt = settings.aiFlashcardPrompts?.[mode];
		const basePrompt = customPrompt?.trim() || DEFAULT_PROMPTS[mode];
		return basePrompt + SOURCE_TRACKING_SUFFIX;
	}
}
