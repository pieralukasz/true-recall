/**
 * Tier required to activate a plugin.
 * - `free`: works without any API key
 * - `byok`: requires an AI key (user's OpenRouter key or Pro key)
 * - `pro`: requires a Pro key
 *
 * Tiers form an inclusive ladder: a Pro user gets everything at `byok` and `free`;
 * a BYOK user gets everything at `free`.
 */
export type PluginTier = "free" | "byok" | "pro";

/**
 * Metadata describing a True Recall plugin for the showcase UI.
 */
export interface PluginInfo {
	id: string;
	name: string;
	description: string;
	features: string[];
	icon: string;
	tier: PluginTier;
}
