import { useState } from "preact/hooks";

import {
	Clickable,
	FormCard,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import { useSettings } from "../hooks/useSettings";
import type { PluginManifest, PluginSettingsProps } from "@true-recall/plugins";
import { PLUGIN_MANIFESTS } from "@true-recall/plugins";

function PluginIcon({ icon }: { icon: string }) {
	const iconRef = useIcon(icon);
	return <span ref={iconRef} class="ep:w-5 ep:h-5 ep:text-obs-accent" />;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	const iconRef = useIcon("chevron-right");
	return (
		<span
			ref={iconRef}
			class={cn(
				"ep:w-4 ep:h-4 ep:text-obs-muted ep:transition-transform ep:duration-200",
				expanded && "ep:rotate-90",
			)}
		/>
	);
}

interface PluginAccordionProps {
	manifest: PluginManifest;
	isPro: boolean;
	isEnabled: boolean;
	isExpanded: boolean;
	onToggle: (enabled: boolean) => void;
	onExpandToggle: () => void;
	settings: PluginSettingsProps["settings"];
	save: PluginSettingsProps["save"];
}

function PluginAccordion({
	manifest,
	isPro,
	isEnabled,
	isExpanded,
	onToggle,
	onExpandToggle,
	settings,
	save,
}: PluginAccordionProps) {
	const { info } = manifest;
	const isActive = isPro && isEnabled;
	const hasSettings = !!manifest.settingsPanel;
	const canExpand = isPro && isActive && hasSettings;

	const SettingsPanel = manifest.settingsPanel;

	return (
		<div
			class={cn(
				"ep:border ep:border-obs-border ep:rounded-lg ep:transition-colors",
				isActive ? "ep:bg-obs-primary" : "ep:bg-obs-secondary/50",
			)}
		>
			<Clickable
				class={cn(
					"ep:p-4 ep:w-full ep:text-left",
					canExpand &&
						"ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-t-lg",
					canExpand && !isExpanded && "ep:rounded-b-lg",
					!canExpand && "ep:cursor-default ep:rounded-lg",
				)}
				onClick={() => {
					if (canExpand) onExpandToggle();
				}}
				stopPropagation={false}
			>
				<div class="ep:flex ep:items-start ep:justify-between ep:gap-3">
					<div class="ep:flex ep:items-center ep:gap-2.5">
						<PluginIcon icon={info.icon} />
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{info.name}
						</div>
						<span
							class={cn(
								"ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:rounded ep:font-medium",
								isActive
									? "ep:bg-green-500/15 ep:text-green-600"
									: "ep:bg-obs-accent/10 ep:text-obs-accent",
							)}
						>
							{isActive ? "Active" : "Pro"}
						</span>
						{canExpand && <ChevronIcon expanded={isExpanded} />}
					</div>

					{isPro ? (
						<Clickable
							stopPropagation
							class="ep:cursor-default"
							onClick={() => {}}
						>
							<ToggleInput
								value={isEnabled}
								onChange={(v) => {
									onToggle(v);
								}}
							/>
						</Clickable>
					) : (
						<Clickable
							class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:font-medium ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:border ep:border-obs-accent/30 ep:hover:bg-obs-accent/20 ep:transition-colors"
							onClick={() =>
								window.open("https://truerecall.com/pricing", "_blank")
							}
						>
							Upgrade to Pro
						</Clickable>
					)}
				</div>

				<p class="ep:text-ui-smaller ep:text-obs-muted ep:mt-2 ep:mb-2 ep:leading-relaxed">
					{info.description}
				</p>

				{!isExpanded && (
					<ul class="ep:list-none ep:p-0 ep:m-0 ep:flex ep:flex-col ep:gap-1">
						{info.features.map((feature: string) => (
							<li
								key={feature}
								class="ep:text-ui-smaller ep:text-obs-muted ep:flex ep:items-start ep:gap-1.5"
							>
								<span class="ep:text-obs-accent ep:mt-0.5 ep:shrink-0">•</span>
								{feature}
							</li>
						))}
					</ul>
				)}
			</Clickable>

			{isExpanded && SettingsPanel && (
				<div class="ep:px-4 ep:pb-4 ep:pt-2 ep:border-t ep:border-obs-border ep:flex ep:flex-col ep:gap-3">
					<SettingsPanel settings={settings} save={save} />
				</div>
			)}
		</div>
	);
}

export function PluginsTab() {
	const { settings, save } = useSettings();
	const isPro = !!settings.proKey;
	const pluginStates = settings.pluginStates ?? {};
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const handleToggle = (pluginId: string, enabled: boolean) => {
		const patch: Partial<typeof settings> = {
			pluginStates: { ...pluginStates, [pluginId]: enabled },
		};
		if (pluginId === "knowledge-base") {
			patch.ragEnabled = enabled;
		}
		void save(patch);
		if (!enabled && expandedId === pluginId) {
			setExpandedId(null);
		}
	};

	const handleExpandToggle = (pluginId: string) => {
		setExpandedId((prev) => (prev === pluginId ? null : pluginId));
	};

	return (
		<FormCard
			title="Plugins"
			description="Pro features. Enable or disable individual plugins to customize your experience."
		>
			<div class="ep:flex ep:flex-col ep:gap-3">
				{PLUGIN_MANIFESTS.map((manifest) => (
					<PluginAccordion
						key={manifest.info.id}
						manifest={manifest}
						isPro={isPro}
						isEnabled={pluginStates[manifest.info.id] !== false}
						isExpanded={expandedId === manifest.info.id}
						onToggle={(enabled) => handleToggle(manifest.info.id, enabled)}
						onExpandToggle={() => handleExpandToggle(manifest.info.id)}
						settings={settings}
						save={save}
					/>
				))}
			</div>
		</FormCard>
	);
}
