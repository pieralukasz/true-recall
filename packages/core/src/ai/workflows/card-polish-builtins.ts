import type { CardAIPreset } from "../../types/card-ai-preset.types";
import type { TrueRecallSettings } from "../../types/settings.types";

/**
 * Card Polish presets that ship with the plugin. The four AI presets are Pro:
 * their full prompts live on the Pro server, which replaces the
 * `<<TR_CARD_POLISH:name>>` line before the request reaches the model. The
 * line above it is a short fallback, so a request that skips the server still
 * carries a usable instruction. "Clean" runs locally and is free for everyone.
 */
export const CARD_POLISH_PROMPT_MARKER = "TR_CARD_POLISH";

function serverPrompt(name: string, fallback: string): string {
	return `${fallback}\n<<${CARD_POLISH_PROMPT_MARKER}:${name}>>`;
}

export const BUILTIN_CARD_POLISH_PRESETS: readonly CardAIPreset[] =
	Object.freeze([
		{
			id: "builtin-polish-sharpen",
			name: "Sharpen",
			prompt: serverPrompt(
				"sharpen",
				"Give the card exactly one correct answer and a short answer. Keep the fact; change as little as possible.",
			),
			autoApply: false,
			builtin: true,
			requiresPro: true,
			includeSourceNote: true,
			includeRelatedCards: true,
			mode: "edit",
			fieldScope: "all",
			executor: "ai",
		},
		{
			id: "builtin-polish-split-list",
			name: "Split List",
			prompt: serverPrompt(
				"split-list",
				"Split the list in the answer into atomic cards, one item or one natural group per card.",
			),
			autoApply: false,
			autoApplyNewCards: false,
			builtin: true,
			requiresPro: true,
			includeSourceNote: true,
			includeRelatedCards: true,
			mode: "split",
			fieldScope: "all",
			executor: "ai",
		},
		{
			id: "builtin-polish-reverse",
			name: "Reverse",
			prompt: serverPrompt(
				"reverse",
				"Create one reverse card that asks the same fact from the other direction.",
			),
			autoApply: false,
			autoApplyNewCards: false,
			builtin: true,
			requiresPro: true,
			includeSourceNote: true,
			includeRelatedCards: true,
			mode: "spawn",
			fieldScope: "all",
			executor: "ai",
		},
		{
			id: "builtin-polish-format",
			name: "Format",
			prompt: serverPrompt(
				"format",
				"Fix the Markdown formatting only. Never change a word.",
			),
			autoApply: false,
			builtin: true,
			requiresPro: true,
			mode: "edit",
			fieldScope: "all",
			executor: "ai",
		},
		{
			id: "builtin-polish-clean",
			name: "Clean",
			prompt:
				"Remove [[links]] (keeping their words) and shorten attachment paths to file names. Runs locally, no AI.",
			autoApply: true,
			builtin: true,
			requiresPro: false,
			mode: "edit",
			fieldScope: "all",
			executor: "clean",
		},
	] satisfies CardAIPreset[]);

/** Pro presets need the Pro server, which holds their prompts. */
export function hasProServer(
	settings: Pick<TrueRecallSettings, "providerType" | "proKey">,
): boolean {
	return settings.providerType === "pro" && !!settings.proKey;
}

/** Built-ins this user can run: Pro ones only with the Pro provider. */
export function availableBuiltinCardPolishPresets(
	settings: Pick<TrueRecallSettings, "providerType" | "proKey">,
): CardAIPreset[] {
	const pro = hasProServer(settings);
	return BUILTIN_CARD_POLISH_PRESETS.filter((p) => !p.requiresPro || pro);
}

/** Built-ins first, then the user's own presets. */
export function listCardPolishPresets(
	settings: Pick<TrueRecallSettings, "providerType" | "proKey" | "cardPolish">,
): CardAIPreset[] {
	return [
		...availableBuiltinCardPolishPresets(settings),
		...(settings.cardPolish?.userPresets ?? []),
	];
}

export function findCardPolishPreset(
	settings: Pick<TrueRecallSettings, "providerType" | "proKey" | "cardPolish">,
	presetId: string,
): CardAIPreset | undefined {
	return listCardPolishPresets(settings).find((p) => p.id === presetId);
}
