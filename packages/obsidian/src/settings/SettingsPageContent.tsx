import { useState } from "preact/hooks";

import { FormVariantProvider } from "@true-recall/obsidian/components/FormVariantContext";
import { usePlugin } from "@true-recall/obsidian/preact";

import type { SettingsPageId } from "./settings-pages";
import { DataTab } from "./tabs/DataTab";
import { FSRSTab } from "./tabs/FSRSTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { IntegrationsTab } from "./tabs/IntegrationsTab";
import { FeaturesTab } from "./tabs/PluginsTab";

function FsrsSettingsPage() {
	const plugin = usePlugin();
	const [selectedPresetId, setSelectedPresetId] = useState(
		() => plugin.settings.defaultPresetId,
	);

	return (
		<FSRSTab
			selectedPresetId={selectedPresetId}
			onPresetChange={setSelectedPresetId}
		/>
	);
}

export function SettingsPageContent({ pageId }: { pageId: SettingsPageId }) {
	return (
		<FormVariantProvider value="native">
			<div class="tr-settings-page">
				{pageId === "general" ? (
					<GeneralTab />
				) : pageId === "fsrs" ? (
					<FsrsSettingsPage />
				) : pageId === "data" ? (
					<DataTab />
				) : pageId === "integrations" ? (
					<IntegrationsTab />
				) : (
					<FeaturesTab />
				)}
			</div>
		</FormVariantProvider>
	);
}
