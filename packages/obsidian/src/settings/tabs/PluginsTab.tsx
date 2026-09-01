import { useState } from "preact/hooks";

import { FormCard } from "@true-recall/obsidian/components";

import { useSettings } from "../hooks/useSettings";
import { AIProviderSection } from "./AIProviderSection";
import { isPluginActive } from "./plugin-availability";
import { PluginAccessOverview } from "./plugins/PluginAccessOverview";
import {
	PLUGIN_TIER_SORT_ORDER,
	PluginAccordion,
} from "./plugins/PluginAccordion";
import { PLUGIN_MANIFESTS } from "@true-recall/plugins";

export function PluginsTab() {
	const { settings, save } = useSettings();
	const pluginStates = settings.pluginStates ?? {};
	const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

	const handleToggle = (pluginId: string, enabled: boolean) => {
		void save({
			pluginStates: { ...pluginStates, [pluginId]: enabled },
		});
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
			<FormCard title="Installed plugins">
				<div class="tr-plugin-list">
					{[...PLUGIN_MANIFESTS]
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
								isEnabled={pluginStates[manifest.info.id] !== false}
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
