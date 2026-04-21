import type { CardAIPreset } from "@true-recall/core";

// TODO(pre-release): copy the authoritative prompt from the ZimaBlade proxy.
// Shipping with prompt: "" is intentional — this plugin has no `activate` yet,
// so the preset is never invoked. Fill the prompt before wiring activation.
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
