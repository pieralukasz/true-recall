import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import type { PluginTier, TrueRecallSettings } from "@true-recall/core/types";

export function isTierUnlocked(
	tier: PluginTier,
	settings: TrueRecallSettings,
): boolean {
	if (tier === "free") return true;
	if (tier === "byok") return hasAIKey(settings);
	return !!settings.proKey;
}

export function isFeatureAvailable(
	settings: TrueRecallSettings,
	featureId: string,
	fallbackTier: PluginTier = "free",
): boolean {
	switch (featureId) {
		case "ai-generation":
			return hasAIKey(settings, "generation");
		case "card-polish":
			return hasAIKey(settings, "card-polish");
		case "ai-assistant":
			return hasAIKey(settings);
		case "image-occlusion":
		case "type-in-mode":
			return !!settings.proKey;
		default:
			return isTierUnlocked(fallbackTier, settings);
	}
}

export function isFeaturePreferenceEnabled(
	settings: TrueRecallSettings,
	featureId: string,
): boolean {
	switch (featureId) {
		case "link-status-indicators":
			return settings.showLinkStatusIndicators;
		case "status-bar-widget":
			return settings.showStatusBarWidget;
		case "ai-generation":
		case "card-polish":
			return settings.pluginStates?.["ai-assistant"] !== false;
		case "type-in-mode":
			return true;
		default:
			return settings.pluginStates?.[featureId] !== false;
	}
}

export function isPluginEnabled(
	settings: TrueRecallSettings,
	pluginId: string,
): boolean {
	if (!isFeatureAvailable(settings, pluginId)) return false;
	return isFeaturePreferenceEnabled(settings, pluginId);
}

export function buildFeatureTogglePatch(
	settings: TrueRecallSettings,
	featureId: string,
	enabled: boolean,
): Partial<TrueRecallSettings> {
	switch (featureId) {
		case "link-status-indicators":
			return { showLinkStatusIndicators: enabled };
		case "status-bar-widget":
			return { showStatusBarWidget: enabled };
		default:
			return {
				pluginStates: {
					...settings.pluginStates,
					[featureId]: enabled,
				},
			};
	}
}
