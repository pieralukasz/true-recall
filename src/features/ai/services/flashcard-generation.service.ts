import {
	DEFAULT_PROMPTS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import type { FlashcardItem } from "@shared/types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { OpenRouterClient } from "./openrouter-client";

export interface GenerationResult {
	flashcards: FlashcardItem[];
	mode: GenerationMode;
}

export class FlashcardGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private parser: FlashcardParserService,
	) {}

	async generate(
		selectedText: string,
		mode: GenerationMode,
	): Promise<GenerationResult> {
		const settings = this.getSettings();

		if (!settings.openRouterApiKey) {
			throw new Error("OpenRouter API key is not configured");
		}

		const client = new OpenRouterClient(
			settings.openRouterApiKey,
			settings.aiModel,
		);
		const systemPrompt = this.getPromptForMode(mode);

		const response = await client.chat({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: selectedText },
			],
			temperature: 0.7,
		});

		const responseText = response.choices[0]?.message?.content ?? "";
		const flashcards = this.parser.extractFlashcards(responseText);

		return { flashcards, mode };
	}

	private getPromptForMode(mode: GenerationMode): string {
		const settings = this.getSettings();
		const customPrompt = settings.aiFlashcardPrompts?.[mode];
		return customPrompt?.trim() || DEFAULT_PROMPTS[mode];
	}
}
