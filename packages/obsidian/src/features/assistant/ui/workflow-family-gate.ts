import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import type { AIWorkflowKind } from "@true-recall/core/ai/workflows/ai-workflow";
import type { TrueRecallSettings } from "@true-recall/core/types";

/** Each preset family still belongs to the feature the user can switch off, even
 * though they all now run in one workspace. */
const FAMILY_PLUGIN_IDS: Record<AIWorkflowKind, string> = {
	agent: "ai-assistant",
	"generate-cards": "ai-generation",
	"modify-card": "card-polish",
	"fact-check": "ai-assistant",
};

/**
 * Whether a preset family may be offered right now.
 *
 * Deliberately does not go through `isPluginEnabled`: that reads
 * `PLUGIN_MANIFESTS`, and the Card Polish manifest imports this module's
 * consumers — a cycle. All three AI manifests declare `tier: "byok"`, so the
 * tier rule collapses to "a key is configured"; the manifests stay the source of
 * truth for every other feature, and `plugin-availability.test.ts` guards
 * against a tier changing under this assumption.
 */
export function isWorkflowFamilyEnabled(
	settings: TrueRecallSettings,
	kind: AIWorkflowKind,
): boolean {
	if (!hasAIKey(settings)) return false;
	return settings.pluginStates?.[FAMILY_PLUGIN_IDS[kind]] !== false;
}
