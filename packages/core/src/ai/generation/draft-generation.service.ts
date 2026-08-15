import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
import type { IHttpClient } from "../../interfaces/http-client";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { getTextContent, OpenRouterClient } from "../clients/openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { parseBlockResponse } from "../parsing/incremental-flashcard-parser";
import type { ExistingCardContext } from "../prompts/existing-cards-block";
import { buildGenerationPrompt } from "../prompts/generation-request";
import { fixBlockSourceTexts } from "../utils/source-text-fixer";

export interface DraftGenerationOptions {
	existingCards?: ExistingCardContext[];
	contextText?: string;
}

/**
 * Preset-aware generation that returns validated card drafts without mutating
 * the flashcard database. It mirrors StreamingGenerationService's prompt
 * semantics so Assistant proposals and legacy direct generation stay aligned.
 */
export class DraftGenerationService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private getNoteTypeBySlug: (slug: string) => NoteType | null,
		private httpClient: IHttpClient,
	) {}

	async generate(
		text: string,
		preset: GenerationPreset,
		noteType: NoteType,
		options?: DraftGenerationOptions,
	): Promise<ParsedBlock[]> {
		const settings = this.getSettings();
		if (preset.requiresPro && !settings.proKey) {
			throw new Error(
				`Preset "${preset.name}" requires True Recall Pro. Upgrade or pick a different preset.`,
			);
		}
		const config = resolveAIClientConfig(settings, "generation");
		const client = new OpenRouterClient(
			config.apiKey,
			config.model,
			this.httpClient,
			config.baseUrl,
			undefined,
			"generation",
			{ providerType: config.providerType },
		);

		const { systemPrompt, userContent, metadata } = buildGenerationPrompt({
			preset,
			noteType,
			text,
			existingCards: options?.existingCards,
			contextText: options?.contextText,
			hasProTier: config.hasProTier,
		});
		const response = await client.chat({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userContent },
			],
			...(config.hasProTier ? {} : { temperature: config.temperature }),
			...(metadata ? { metadata } : {}),
		});

		const raw = getTextContent(response.choices[0]?.message);
		const blocks = parseBlockResponse(raw, this.getNoteTypeBySlug, {
			allowEmptyAnswer: preset.allowEmptyAnswer,
		});
		fixBlockSourceTexts(blocks, text);
		return blocks;
	}
}
