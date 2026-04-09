import { useCallback, useState } from "preact/hooks";

import { ENABLE_RAG } from "@true-recall/core/constants";

import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";

import { AITab } from "./tabs/AITab";
import { DataTab } from "./tabs/DataTab";
import { FSRSTab } from "./tabs/FSRSTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { KnowledgeBaseTab } from "./tabs/KnowledgeBaseTab";

type SettingsTabId = "general" | "ai" | "fsrs" | "data" | "knowledge-base";

const TABS: { id: SettingsTabId; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "ai", label: "AI" },
	{ id: "fsrs", label: "FSRS" },
	{ id: "data", label: "Data & Backup" },
	...(ENABLE_RAG
		? [{ id: "knowledge-base" as const, label: "Knowledge Base" }]
		: []),
];

const TAB_BTN_BASE =
	"ep:py-1.5 ep:px-3 ep:border-none ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:rounded-md ep:text-ui-small ep:font-medium ep:transition-colors ep:duration-150 ep:shrink-0 ep:whitespace-nowrap ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover";
const TAB_BTN_ACTIVE =
	"ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-semibold ep:hover:bg-obs-interactive/15 ep:hover:text-obs-interactive";

function TabBar({
	activeTab,
	onTabChange,
}: {
	activeTab: SettingsTabId;
	onTabChange: (id: SettingsTabId) => void;
}) {
	return (
		<div
			class="ep:flex ep:gap-1 ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border ep:overflow-x-auto"
			role="tablist"
		>
			{TABS.map((tab) => (
				<Clickable
					key={tab.id}
					class={`${TAB_BTN_BASE} ${activeTab === tab.id ? TAB_BTN_ACTIVE : ""}`}
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
		<>
			<TabBar activeTab={activeTab} onTabChange={handleTabChange} />
			<div
				key={activeTab}
				role="tabpanel"
				id={`true-recall-tabpanel-${activeTab}`}
				class="ep:mx-auto ep:max-w-3xl ep:pb-4 ep-section-enter"
			>
				{activeTab === "general" && <GeneralTab />}
				{activeTab === "ai" && <AITab />}
				{activeTab === "fsrs" && (
					<FSRSTab
						selectedPresetId={selectedPresetId}
						onPresetChange={setSelectedPresetId}
					/>
				)}
				{activeTab === "data" && <DataTab />}
				{activeTab === "knowledge-base" && <KnowledgeBaseTab />}
			</div>
		</>
	);
}
