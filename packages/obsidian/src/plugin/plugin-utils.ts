import type { TrueRecallSettings } from "@true-recall/core/types";

import { PLUGIN_MANIFESTS } from "@true-recall/plugins";

export function isPluginEnabled(
	settings: TrueRecallSettings,
	pluginId: string,
): boolean {
	const manifest = PLUGIN_MANIFESTS.find((m) => m.info.id === pluginId);
	if (manifest?.info.requiresPro && !settings.proKey) return false;
	return settings.pluginStates?.[pluginId] !== false;
}
