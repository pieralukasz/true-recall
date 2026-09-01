import { useCallback, useState } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { FormVariantProvider } from "@true-recall/obsidian/components/FormVariantContext";
import { usePlugin } from "@true-recall/obsidian/preact";

import { DataTab } from "./tabs/DataTab";
import { FSRSTab } from "./tabs/FSRSTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { IntegrationsTab } from "./tabs/IntegrationsTab";
import { PluginsTab } from "./tabs/PluginsTab";

type SettingsTabId = "general" | "fsrs" | "data" | "integrations" | "plugins";

const TABS: { id: SettingsTabId; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "fsrs", label: "FSRS" },
	{ id: "data", label: "Data & Backup" },
	{ id: "integrations", label: "Integrations" },
	{ id: "plugins", label: "Plugins" },
];

/* Styled in settings.styles.css rather than with utilities: the accent tint
   this used to rely on (`ep:bg-obs-interactive/15`) is a `color-mix()` on an
   Obsidian variable, and the CSS postprocess step collapses those to a flat
   grey, so the active tab had no accent at all. */

function TabBar({
	activeTab,
	onTabChange,
}: {
	activeTab: SettingsTabId;
	onTabChange: (id: SettingsTabId) => void;
}) {
	return (
		<div class="tr-settings-tabs" role="tablist">
			{TABS.map((tab) => (
				<Clickable
					key={tab.id}
					class={`tr-settings-tab${activeTab === tab.id ? " is-active" : ""}`}
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls={`true-recall-tabpanel-${tab.id}`}
					stopPropagation={false}
					onClick={() => onTabChange(tab.id)}
				>
					{tab.label}
				</Clickable>
			))}
		</div>
	);
}

export function SettingsApp() {
	const plugin = usePlugin();
	const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
	const [selectedPresetId, setSelectedPresetId] = useState(
		() => plugin.settings.defaultPresetId,
	);

	const handleTabChange = useCallback((id: SettingsTabId) => {
		setActiveTab(id);
	}, []);

	return (
		<FormVariantProvider value="native">
			<TabBar activeTab={activeTab} onTabChange={handleTabChange} />
			<div
				key={activeTab}
				role="tabpanel"
				id={`true-recall-tabpanel-${activeTab}`}
				class="tr-settings-panel ep-section-enter"
			>
				{activeTab === "general" && <GeneralTab />}
				{activeTab === "fsrs" && (
					<FSRSTab
						selectedPresetId={selectedPresetId}
						onPresetChange={setSelectedPresetId}
					/>
				)}
				{activeTab === "data" && <DataTab />}
				{activeTab === "integrations" && <IntegrationsTab />}
				{activeTab === "plugins" && <PluginsTab />}
			</div>
		</FormVariantProvider>
	);
}
