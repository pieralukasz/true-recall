import {
	buildLanguageSuffix,
	DEFAULT_PROMPTS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { ParsedBlock } from "@features/study/services/flashcard/block-parser.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { resolveAIClientConfig } from "./ai-client-config";
import { parseBlockResponse } from "./incremental-flashcard-parser";
import { getTextContent, OpenRouterClient } from "./openrouter-client";
import { SOURCE_TRACKING_SUFFIX } from "./streaming-generation.service";

export interface GenerationResult {
	blocks: ParsedBlock[];
	mode: GenerationMode;
}

export class FlashcardGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private getNoteType: (slug: string) => NoteType | null,
	) {}

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
		);
		const systemPrompt = this.getPromptForMode(mode);

		const request = {
			messages: [
				{ role: "system" as const, content: systemPrompt },
				{ role: "user" as const, content: selectedText },
			],
			temperature: 0.7,
		};

		const response = await client.chat(request);
		const responseText = getTextContent(response.choices[0]?.message);
		const blocks = this.parseResponse(responseText);
		return { blocks, mode };
	}

	private parseResponse(text: string): ParsedBlock[] {
		const blocks = parseBlockResponse(text, this.getNoteType);
		if (text.trim() && blocks.length === 0) {
			console.warn(
				"[TrueRecall] AI response produced no parseable flashcards",
				{ responseLength: text.length },
			);
		}
		return blocks;
	}

	private getPromptForMode(mode: GenerationMode): string {
		const settings = this.getSettings();
		const customPrompt = settings.aiFlashcardPrompts?.[mode];
		const basePrompt = customPrompt?.trim() || DEFAULT_PROMPTS[mode];
		const langSuffix = buildLanguageSuffix(
			settings.generationLanguage ?? "auto",
		);
		return basePrompt + SOURCE_TRACKING_SUFFIX + langSuffix;
	}
}
