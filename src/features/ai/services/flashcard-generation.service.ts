import {
	buildLanguageSuffix,
	DEFAULT_PROMPTS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import type { ParsedBlock } from "@features/study/services/flashcard/block-parser.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { resolveAIClientConfig } from "./ai-client-config";
import { IncrementalFlashcardParser } from "./incremental-flashcard-parser";
import { getTextContent, OpenRouterClient } from "./openrouter-client";

const SOURCE_TRACKING_SUFFIX = `

SOURCE TRACKING (MANDATORY):
After each answer, on a new line, add: <!-- source: [exact verbatim quote from the input text] -->
The quote must be EXACTLY copied from the input — same words, same punctuation. Keep it to the specific sentence(s) for that flashcard.`;

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
		const parser = new IncrementalFlashcardParser(this.getNoteType);
		parser.feed(text);
		const blocks = parser
			.finish()
			.filter(
				(e): e is { type: "card_complete"; block: ParsedBlock } =>
					e.type === "card_complete" && e.block !== null,
			)
			.map((e) => e.block);
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
