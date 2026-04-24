import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
import type { IHttpClient } from "../../interfaces/http-client";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { getTextContent, OpenRouterClient } from "../clients/openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { parseBlockResponse } from "../parsing/incremental-flashcard-parser";
import {
	buildByokPrompt,
	buildCardFormatSpec,
} from "../prompts/block-prompt-builder";
import { fixBlockSourceTexts } from "../utils/source-text-fixer";
import { FALLBACK_BASIC_NOTE_TYPE } from "./streaming-generation.service";

export interface GenerationResult {
	blocks: ParsedBlock[];
}

export class FlashcardGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private getNoteType: (slug: string) => NoteType | null,
		private httpClient: IHttpClient,
	) {}

	async generate(
		selectedText: string,
		noteType?: NoteType | null,
	): Promise<GenerationResult> {
		const settings = this.getSettings();
		const config = resolveAIClientConfig(settings);

		const client = new OpenRouterClient(
			config.apiKey,
			config.model,
			this.httpClient,
			config.baseUrl,
		);

		const systemPrompt = config.hasProTier
			? settings.aiGenerationPrompt?.trim() || ""
			: buildByokPrompt(
					noteType ?? FALLBACK_BASIC_NOTE_TYPE,
					settings.generationLanguage ?? "auto",
					settings.aiGenerationPrompt,
				);

		const userContent = config.hasProTier
			? `${buildCardFormatSpec(noteType ?? FALLBACK_BASIC_NOTE_TYPE)}\n\n${selectedText}`
			: selectedText;

		const messages = systemPrompt
			? [
					{ role: "system" as const, content: systemPrompt },
					{ role: "user" as const, content: userContent },
				]
			: [{ role: "user" as const, content: userContent }];

		const metadata = config.hasProTier
			? { call_context: "generation", note_type: noteType?.slug ?? "basic" }
			: undefined;

		const request = {
			messages,
			...(config.hasProTier ? {} : { temperature: config.temperature }),
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
