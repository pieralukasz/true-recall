import { useState } from "preact/hooks";

import { FormCard } from "@true-recall/obsidian/components";
import {
	buildFeatureTogglePatch,
	isFeaturePreferenceEnabled,
} from "@true-recall/obsidian/plugin/plugin-utils";

import { useSettings } from "../hooks/useSettings";
import { AIProviderSection } from "./AIProviderSection";
import { isPluginActive } from "./plugin-availability";
import { PluginAccessOverview } from "./plugins/PluginAccessOverview";
import {
	PLUGIN_TIER_SORT_ORDER,
	PluginAccordion,
} from "./plugins/PluginAccordion";
import { FEATURE_MANIFESTS } from "@true-recall/plugins";

export function FeaturesTab() {
	const { settings, save } = useSettings();
	const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

	const handleToggle = (featureId: string, enabled: boolean) => {
		void save(buildFeatureTogglePatch(settings, featureId, enabled));
	};

	const handleExpandToggle = (pluginId: string) => {
		setExpandedIds((previous) => {
			const next = new Set(previous);
			if (next.has(pluginId)) {
				next.delete(pluginId);
			} else {
				next.add(pluginId);
			}
			return next;
		});
	};

	return (
		<div class="tr-settings-sections">
			<PluginAccessOverview settings={settings} />
			<AIProviderSection />
			<FormCard
				title="Features"
				description="Optional True Recall surfaces. Review modes and data tools live in their relevant settings sections."
			>
				<div class="tr-plugin-list">
					{[...FEATURE_MANIFESTS]
						.sort(
							(a, b) =>
								PLUGIN_TIER_SORT_ORDER[a.info.tier] -
								PLUGIN_TIER_SORT_ORDER[b.info.tier],
						)
						.map((manifest) => (
							<PluginAccordion
								key={manifest.info.id}
								manifest={manifest}
								isActive={isPluginActive(manifest, settings)}
								isEnabled={isFeaturePreferenceEnabled(
									settings,
									manifest.info.id,
								)}
								isExpanded={expandedIds.has(manifest.info.id)}
								onToggle={(enabled) => handleToggle(manifest.info.id, enabled)}
								onExpandToggle={() => handleExpandToggle(manifest.info.id)}
								settings={settings}
								save={save}
							/>
						))}
				</div>
			</FormCard>
		</div>
	);
}
