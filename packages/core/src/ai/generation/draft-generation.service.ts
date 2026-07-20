import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
import type { IHttpClient } from "../../interfaces/http-client";
import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";
import { getTextContent, OpenRouterClient } from "../clients/openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { parseBlockResponse } from "../parsing/incremental-flashcard-parser";
import {
	buildPresetFormatSpec,
	buildPresetPrompt,
} from "../prompts/block-prompt-builder";
import { buildLanguageSuffix } from "../prompts/default-prompts";
import {
	type ExistingCardContext,
	renderExistingCardsBlock,
} from "../prompts/existing-cards-block";
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

		const useRawPrompt = preset.prompt.includes("{{EXISTING_CARDS}}");
		const basePrompt = useRawPrompt
			? preset.prompt
			: buildPresetPrompt(preset, noteType);
		const existingCards = renderExistingCardsBlock(
			options?.existingCards ?? [],
		);
		let systemPrompt = basePrompt.replace("{{EXISTING_CARDS}}", existingCards);
		if (options?.contextText?.trim()) {
			systemPrompt = `${options.contextText.trim()}\n\n${systemPrompt}`;
		}
		const languageSuffix = buildLanguageSuffix(
			preset.languageOverride ?? "auto",
		);
		if (languageSuffix) systemPrompt += languageSuffix;

		const userContent = useRawPrompt
			? `${buildPresetFormatSpec(noteType)}\n\n${text}`
			: text;
		const response = await client.chat({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userContent },
			],
			...(config.hasProTier ? {} : { temperature: config.temperature }),
			...(config.hasProTier
				? {
						metadata: {
							call_context: "generation",
							note_type: noteType.slug ?? "basic",
							preset_id: preset.id,
						},
					}
				: {}),
		});

		const raw = getTextContent(response.choices[0]?.message);
		const blocks = parseBlockResponse(raw, this.getNoteTypeBySlug);
		fixBlockSourceTexts(blocks, text);
		return blocks;
	}
}
