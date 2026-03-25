import type { ParsedBlock } from "@features/study/services/flashcard/block-parser.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { resolveAIClientConfig } from "./ai-client-config";
import { parseBlockResponse } from "./incremental-flashcard-parser";
import { getTextContent, OpenRouterClient } from "./openrouter-client";
import {
	buildGenerationPrompt,
	SOURCE_TRACKING_SUFFIX,
} from "./streaming-generation.service";

export interface GenerationResult {
	blocks: ParsedBlock[];
}

export class FlashcardGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private getNoteType: (slug: string) => NoteType | null,
	) {}

	async generate(
		selectedText: string,
		noteType?: NoteType | null,
	): Promise<GenerationResult> {
		const settings = this.getSettings();
		const config = resolveAIClientConfig(settings);

		const client = new OpenRouterClient(config.apiKey, config.model, config.baseUrl);
		const systemPrompt = buildGenerationPrompt(settings, noteType);

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
		return { blocks };
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
}
