import {
	DEFAULT_PROMPTS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import type { FlashcardItem } from "@shared/types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

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

		const llm = new ChatOpenAI({
			modelName: settings.aiModel,
			configuration: {
				baseURL: "https://openrouter.ai/api/v1",
				apiKey: settings.openRouterApiKey,
				defaultHeaders: {
					"HTTP-Referer": "obsidian://true-recall",
					"X-Title": "True Recall",
				},
			},
			temperature: 0.7,
		});

		const systemPrompt = this.getPromptForMode(mode);

		const response = await llm.invoke([
			new SystemMessage(systemPrompt),
			new HumanMessage(selectedText),
		]);

		const responseText =
			typeof response.content === "string"
				? response.content
				: response.content
						.filter(
							(block): block is { type: "text"; text: string } =>
								typeof block === "object" &&
								"type" in block &&
								block.type === "text",
						)
						.map((block) => block.text)
						.join("\n");

		const flashcards = this.parser.extractFlashcards(responseText);

		return { flashcards, mode };
	}

	private getPromptForMode(mode: GenerationMode): string {
		const settings = this.getSettings();
		const customPrompt = settings.aiFlashcardPrompts?.[mode];
		return customPrompt?.trim() || DEFAULT_PROMPTS[mode];
	}
}
