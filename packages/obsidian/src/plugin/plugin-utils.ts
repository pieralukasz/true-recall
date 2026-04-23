import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import type { PluginTier, TrueRecallSettings } from "@true-recall/core/types";

import { PLUGIN_MANIFESTS } from "@true-recall/plugins";

export function isTierUnlocked(
	tier: PluginTier,
	settings: TrueRecallSettings,
): boolean {
	if (tier === "free") return true;
	if (tier === "byok") return hasAIKey(settings);
	return !!settings.proKey;
}

export function isPluginEnabled(
	settings: TrueRecallSettings,
	pluginId: string,
): boolean {
	const manifest = PLUGIN_MANIFESTS.find((m) => m.info.id === pluginId);
	if (manifest && !isTierUnlocked(manifest.info.tier, settings)) return false;
	return settings.pluginStates?.[pluginId] !== false;
}
