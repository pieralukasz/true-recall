import type { GenerationPreset } from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import {
	buildPresetFormatSpec,
	buildPresetPrompt,
} from "./block-prompt-builder";
import { buildLanguageSuffix } from "./default-prompts";
import {
	type ExistingCardContext,
	renderExistingCardsBlock,
} from "./existing-cards-block";

/**
 * Identifies a chunk of a larger note so the model knows where the excerpt sits
 * without seeing the rest of the document.
 */
export interface GenerationChunkContext {
	headingBreadcrumb?: string | null;
	sourceName: string;
}

export interface GenerationPromptInput {
	preset: GenerationPreset;
	noteType: NoteType;
	/** Source material the cards are generated from. */
	text: string;
	existingCards?: readonly ExistingCardContext[];
	/** Pre-rendered context (source note body, related cards) prepended to the system prompt. */
	contextText?: string;
	hasProTier?: boolean;
	chunk?: GenerationChunkContext;
}

export interface GenerationPromptMetadata extends Record<string, unknown> {
	call_context: string;
	note_type: string;
	preset_id: string;
}

export interface GenerationPromptResult {
	systemPrompt: string;
	userContent: string;
	/** Only sent on the Pro tier, where the proxy uses it for attribution. */
	metadata?: GenerationPromptMetadata;
}

/**
 * A preset prompt carrying `{{EXISTING_CARDS}}` is an authoritative, complete
 * system prompt (the built-in Pro preset). It is used verbatim and the format
 * spec rides along in the user message instead of wrapping the prompt.
 */
export function usesRawPresetPrompt(preset: GenerationPreset): boolean {
	return preset.prompt.includes("{{EXISTING_CARDS}}");
}

/**
 * Single source of truth for how a generation preset becomes an LLM request.
 * Every generation path — streaming, chunked, and draft-only — builds its
 * messages here so a prompt change lands everywhere at once.
 */
export function buildGenerationPrompt(
	input: GenerationPromptInput,
): GenerationPromptResult {
	const { preset, noteType } = input;
	const useRawPrompt = usesRawPresetPrompt(preset);

	const basePrompt = useRawPrompt
		? preset.prompt
		: buildPresetPrompt(preset, noteType);
	const existingCardsBlock = renderExistingCardsBlock([
		...(input.existingCards ?? []),
	]);

	let systemPrompt = basePrompt.replace(
		"{{EXISTING_CARDS}}",
		existingCardsBlock,
	);
	if (input.contextText?.trim()) {
		systemPrompt = `${input.contextText.trim()}\n\n${systemPrompt}`;
	}
	const langSuffix = buildLanguageSuffix(preset.languageOverride ?? "auto");
	if (langSuffix) systemPrompt = `${systemPrompt}${langSuffix}`;

	const formatPrefix = useRawPrompt
		? `${buildPresetFormatSpec(noteType)}\n\n`
		: "";
	const chunkPrefix = input.chunk?.headingBreadcrumb
		? `[Context: This section is from "${input.chunk.headingBreadcrumb}" in the note "${input.chunk.sourceName}"]\n\n`
		: "";

	return {
		systemPrompt,
		userContent: `${formatPrefix}${chunkPrefix}${input.text}`,
		metadata: input.hasProTier
			? {
					call_context: "generation",
					note_type: noteType.slug ?? "basic",
					preset_id: preset.id,
				}
			: undefined,
	};
}
