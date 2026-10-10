import type { CardAIPreset } from "@true-recall/core";
import { BUILTIN_CARD_POLISH_PRESETS } from "@true-recall/core/ai/workflows/card-polish-builtins";

/** Sharpen, Split List, Reverse and Format (Pro, prompts on the Pro server) and Clean (local, free). */
export const CARD_POLISH_BUILTINS: CardAIPreset[] = [
	...BUILTIN_CARD_POLISH_PRESETS,
];
