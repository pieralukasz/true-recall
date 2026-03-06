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
	_feature: "nlQuery" | "customPrompts",
	settings: TrueRecallSettings,
): boolean {
	if (settings.openRouterApiKey) return true;
	const tier = getEffectiveTier(settings);
	return tier === "starter";
}

export function isModelAllowed(
	model: string,
	settings: TrueRecallSettings,
	cachedAllowedModels: string[] | null | undefined,
): boolean {
	// BYOK users without subscription can use any model
	if (settings.openRouterApiKey && !settings.subscriptionKey) return true;
	// No cached data yet — allow (server enforces anyway)
	if (!cachedAllowedModels) return true;
	return cachedAllowedModels.includes(model);
}
