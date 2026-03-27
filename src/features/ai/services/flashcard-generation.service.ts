import type { ParsedBlock } from "@features/study/services/flashcard/block-parser.service";
import type { NoteType } from "@shared/types/note.types";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { buildCardFormatSpec } from "@features/ai/prompts/block-prompt-builder";
import { resolveAIClientConfig } from "./ai-client-config";
import { parseBlockResponse } from "./incremental-flashcard-parser";
import { getTextContent, OpenRouterClient } from "./openrouter-client";
import { fixBlockSourceTexts } from "./source-text-fixer";
import { buildGenerationPrompt, FALLBACK_BASIC_NOTE_TYPE } from "./streaming-generation.service";

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

		const customPrompt = settings.aiGenerationPrompt?.trim() || "";
		const systemPrompt = config.isPro
			? customPrompt
			: buildGenerationPrompt(settings, noteType);

		const userContent = config.isPro
			? `${buildCardFormatSpec(noteType ?? FALLBACK_BASIC_NOTE_TYPE)}\n\n${selectedText}`
			: selectedText;

		const messages = systemPrompt
			? [
					{ role: "system" as const, content: systemPrompt },
					{ role: "user" as const, content: userContent },
				]
			: [{ role: "user" as const, content: userContent }];

		const metadata = config.isPro
			? { call_context: "generation", note_type: noteType?.slug ?? "basic" }
			: undefined;

		const request = {
			messages,
			...(config.isPro ? {} : { temperature: config.temperature }),
			metadata,
		};

		const response = await client.chat(request);
		const responseText = getTextContent(response.choices[0]?.message);
		const blocks = this.parseResponse(responseText);
		fixBlockSourceTexts(blocks, selectedText);
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
