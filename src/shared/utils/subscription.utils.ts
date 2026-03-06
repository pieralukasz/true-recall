import type { TrueRecallSettings } from "@shared/types/settings.types";

export type SubscriptionTier = "free" | "starter" | "pro";

export function getEffectiveTier(
	settings: TrueRecallSettings,
): SubscriptionTier {
	if (settings.subscriberTier === "pro") return "pro";
	if (settings.subscriberTier === "starter") return "starter";
	return "free";
}

export function isFeatureAllowed(
	_feature: "nlQuery" | "customPrompts",
	settings: TrueRecallSettings,
): boolean {
	if (settings.openRouterApiKey) return true;
	const tier = getEffectiveTier(settings);
	return tier === "starter" || tier === "pro";
}
