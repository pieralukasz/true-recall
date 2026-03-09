import type { TrueRecallSettings } from "@shared/types/settings.types";

export type SubscriptionTier = "free" | "trial" | "starter";

export function getEffectiveTier(
	settings: TrueRecallSettings,
): SubscriptionTier {
	if (settings.subscriberTier === "starter") return "starter";
	if (settings.subscriberTier === "trial") return "trial";
	return "free";
}

export function isFeatureAllowed(
	_feature: "nlQuery",
	settings: TrueRecallSettings,
): boolean {
	if (settings.openRouterApiKey) return true;
	const tier = getEffectiveTier(settings);
	return tier === "starter";
}
