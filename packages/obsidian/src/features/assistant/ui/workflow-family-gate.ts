import type { AIWorkflowKind } from "@true-recall/core/ai/workflows/ai-workflow";
import type { TrueRecallSettings } from "@true-recall/core/types";

import { isPluginEnabled } from "@true-recall/obsidian/plugin/plugin-utils";

const FAMILY_FEATURE_IDS: Record<AIWorkflowKind, string> = {
	agent: "ai-assistant",
	"generate-cards": "ai-generation",
	"modify-card": "card-polish",
	"fact-check": "ai-assistant",
};

/**
 * Whether a preset family may be offered right now.
 *
 * Generator and Card Polish are workflow families inside AI Workspace. Their
 * legacy feature IDs retain scoped provider checks, but all three share the
 * single AI Workspace preference.
 */
export function isWorkflowFamilyEnabled(
	settings: TrueRecallSettings,
	kind: AIWorkflowKind,
): boolean {
	return isPluginEnabled(settings, FAMILY_FEATURE_IDS[kind]);
}
