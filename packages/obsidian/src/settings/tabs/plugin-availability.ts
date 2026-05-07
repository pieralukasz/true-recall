import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import type { TrueRecallSettings } from "@true-recall/core/types";

import type { PluginManifest } from "@true-recall/plugins";

export function isPluginActive(
	manifest: PluginManifest,
	settings: TrueRecallSettings,
): boolean {
	if (manifest.info.tier === "free") return true;
	if (manifest.info.id === "ai-generation") {
		return hasAIKey(settings, "generation");
	}
	if (manifest.info.tier === "byok") {
		return hasAIKey(settings);
	}
	return !!settings.proKey;
}
