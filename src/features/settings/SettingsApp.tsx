import { useCallback, useState } from "preact/hooks";
import { usePlugin } from "@shared/ui/preact";
import { AITab } from "@features/settings/tabs/AITab";
import { DataTab } from "@features/settings/tabs/DataTab";
import { FSRSTab } from "@features/settings/tabs/FSRSTab";
import { GeneralTab } from "@features/settings/tabs/GeneralTab";
import { SchedulingTab } from "@features/settings/tabs/SchedulingTab";
import { SyncTab } from "@features/settings/tabs/SyncTab";

type SettingsTabId = "general" | "ai" | "scheduling" | "fsrs" | "data" | "sync";

const TABS: { id: SettingsTabId; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "ai", label: "AI" },
	{ id: "scheduling", label: "Scheduling" },
	{ id: "fsrs", label: "FSRS" },
	{ id: "data", label: "Data & Backup" },
	{ id: "sync", label: "Cloud Sync" },
];

const TAB_BTN_BASE =
	"ep:py-2 ep:px-4 ep:border-none ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:rounded-t ep:text-ui-small ep:font-medium ep:transition-colors ep:shrink-0 ep:whitespace-nowrap ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal";
const TAB_BTN_ACTIVE =
	"ep:bg-obs-interactive ep:text-obs-on-accent ep:hover:bg-obs-interactive ep:hover:text-obs-on-accent";

function TabBar({
	activeTab,
	onTabChange,
}: {
	activeTab: SettingsTabId;
	onTabChange: (id: SettingsTabId) => void;
}) {
	return (
		<div
			class="ep:flex ep:gap-1 ep:mb-5 ep:border-b ep:border-obs-border ep:pb-2 ep:overflow-x-auto"
			role="tablist"
		>
			{TABS.map((tab) => (
				<button
					type="button"
					key={tab.id}
					class={`${TAB_BTN_BASE} ${activeTab === tab.id ? TAB_BTN_ACTIVE : ""}`}
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls={`true-recall-tabpanel-${tab.id}`}
					onClick={() => onTabChange(tab.id)}
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
		<>
			<TabBar activeTab={activeTab} onTabChange={handleTabChange} />
			<div role="tabpanel" id={`true-recall-tabpanel-${activeTab}`}>
				{activeTab === "general" && <GeneralTab />}
				{activeTab === "ai" && <AITab />}
				{activeTab === "scheduling" && (
					<SchedulingTab selectedPresetId={selectedPresetId} />
				)}
				{activeTab === "fsrs" && (
					<FSRSTab
						selectedPresetId={selectedPresetId}
						onPresetChange={setSelectedPresetId}
					/>
				)}
				{activeTab === "data" && <DataTab />}
				{activeTab === "sync" && <SyncTab />}
			</div>
		</>
	);
}
