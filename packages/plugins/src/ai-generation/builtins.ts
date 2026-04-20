import type { CardAIPreset } from "@true-recall/core";

/**
 * Pro-gated built-in. The prompt body mirrors the ZimaBlade proxy expectation.
 * Lucas: paste the authoritative prompt from the proxy before release.
 */
const PRO_GENERATE_FROM_NOTE: CardAIPreset = {
	id: "builtin-pro-generate-from-note",
	name: "Generate from note (Pro)",
	prompt: "",
	autoApply: false,
	builtin: true,
	requiresPro: true,
	includeSourceNote: true,
	includeRelatedCards: false,
};

export const AI_GENERATION_BUILTINS: CardAIPreset[] = [PRO_GENERATE_FROM_NOTE];
