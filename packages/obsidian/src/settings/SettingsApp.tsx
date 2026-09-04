import { useCallback, useState } from "preact/hooks";

import { FormVariantProvider } from "@true-recall/obsidian/components/FormVariantContext";
import { usePlugin } from "@true-recall/obsidian/preact";

import { DataTab } from "./tabs/DataTab";
import { FSRSTab } from "./tabs/FSRSTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { IntegrationsTab } from "./tabs/IntegrationsTab";
import { FeaturesTab } from "./tabs/PluginsTab";

type SettingsTabId = "general" | "fsrs" | "data" | "integrations" | "features";

const TABS: { id: SettingsTabId; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "fsrs", label: "FSRS" },
	{ id: "data", label: "Data & Backup" },
	{ id: "integrations", label: "Integrations" },
	{ id: "features", label: "Features" },
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
	const handleKeyDown = (event: KeyboardEvent, index: number) => {
		if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
			return;
		}

		event.preventDefault();
		const nextIndex =
			event.key === "Home"
				? 0
				: event.key === "End"
					? TABS.length - 1
					: (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
						TABS.length;
		const nextTab = TABS[nextIndex];
		if (!nextTab) return;
		onTabChange(nextTab.id);
		requestAnimationFrame(() => {
			document.getElementById(`true-recall-tab-${nextTab.id}`)?.focus();
		});
	};

	return (
		<div class="tr-settings-tabs" role="tablist">
			{TABS.map((tab, index) => (
				<button
					key={tab.id}
					type="button"
					id={`true-recall-tab-${tab.id}`}
					class={`tr-settings-tab${activeTab === tab.id ? " is-active" : ""}`}
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls={`true-recall-tabpanel-${tab.id}`}
					tabIndex={activeTab === tab.id ? 0 : -1}
					onClick={() => onTabChange(tab.id)}
					onKeyDown={(event) => handleKeyDown(event, index)}
				>
					{tab.label}
				</button>
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
				aria-labelledby={`true-recall-tab-${activeTab}`}
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
				{activeTab === "features" && <FeaturesTab />}
			</div>
		</FormVariantProvider>
	);
}
