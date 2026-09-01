import type { PluginTier } from "@true-recall/core/types";

import { Clickable, ToggleInput } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import type { PluginManifest, PluginSettingsProps } from "@true-recall/plugins";

const TIER_LABEL: Record<PluginTier, string> = {
	free: "FREE",
	byok: "BYOK",
	pro: "PRO",
};

const TIER_BADGE_CLASS: Record<PluginTier, string> = {
	free: "ep:bg-obs-green/15 ep:text-obs-green",
	byok: "ep:bg-obs-blue/15 ep:text-obs-blue",
	pro: "ep:bg-obs-accent/10 ep:text-obs-accent",
};

export const PLUGIN_TIER_SORT_ORDER: Record<PluginTier, number> = {
	free: 0,
	byok: 1,
	pro: 2,
};

function PluginIcon({ icon }: { icon: string }) {
	const iconRef = useIcon(icon);
	return <span ref={iconRef} class="tr-plugin-row__icon" />;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	const iconRef = useIcon("chevron-right");
	return (
		<span
			ref={iconRef}
			class={cn("tr-plugin-row__chevron", expanded && "is-expanded")}
		/>
	);
}

interface PluginAccordionProps {
	manifest: PluginManifest;
	isActive: boolean;
	isEnabled: boolean;
	isExpanded: boolean;
	onToggle: (enabled: boolean) => void;
	onExpandToggle: () => void;
	settings: PluginSettingsProps["settings"];
	save: PluginSettingsProps["save"];
}

export function PluginAccordion({
	manifest,
	isActive,
	isEnabled,
	isExpanded,
	onToggle,
	onExpandToggle,
	settings,
	save,
}: PluginAccordionProps) {
	const { info } = manifest;
	const isOn = isActive && isEnabled;
	const SettingsPanel = manifest.settingsPanel;

	return (
		<div
			class={cn(
				"tr-plugin-item",
				!isActive && "is-unavailable",
				isActive && !isOn && "is-disabled",
			)}
		>
			<Clickable
				class="tr-plugin-row"
				onClick={onExpandToggle}
				stopPropagation={false}
			>
				<PluginIcon icon={info.icon} />
				<span class="tr-plugin-row__name">{info.name}</span>
				<span class="tr-plugin-row__badges">
					<span class={cn("tr-plugin-tier", TIER_BADGE_CLASS[info.tier])}>
						{TIER_LABEL[info.tier]}
					</span>
					{info.deprecated ? (
						<span class="tr-plugin-tier ep:bg-obs-orange/15 ep:text-obs-orange">
							DEPRECATED
						</span>
					) : null}
				</span>
				<span class="tr-plugin-row__chevron-slot">
					<ChevronIcon expanded={isExpanded} />
				</span>
				<span class="tr-plugin-row__control">
					{isActive ? (
						<Clickable
							stopPropagation
							preventDefault={false}
							class="tr-plugin-row__toggle"
							onClick={() => {}}
						>
							<ToggleInput value={isEnabled} onChange={onToggle} />
						</Clickable>
					) : (
						<Clickable
							class="tr-plugin-upgrade"
							onClick={() =>
								window.open("https://truerecall.com/pricing", "_blank")
							}
						>
							Upgrade
						</Clickable>
					)}
				</span>
			</Clickable>

			{isExpanded ? (
				<div class="tr-plugin-details">
					<div class="tr-plugin-details__description">
						<p>{info.description}</p>
						<ul class="tr-plugin-features">
							{info.features.map((feature) => (
								<li key={feature}>{feature}</li>
							))}
						</ul>
						{info.deprecated ? (
							<p class="ep:text-obs-orange">{info.deprecated.message}</p>
						) : null}
						{!isActive ? (
							<div class="tr-plugin-details__locked">
								<span>
									{info.tier === "pro"
										? "Included with True Recall Pro."
										: "Add an AI provider to enable this plugin."}
								</span>
								{info.tier === "pro" ? (
									<Clickable
										class="tr-plugin-upgrade"
										onClick={() =>
											window.open("https://truerecall.com/pricing", "_blank")
										}
									>
										See Pro plans
									</Clickable>
								) : null}
							</div>
						) : null}
					</div>
					{SettingsPanel && isActive ? (
						<div class="tr-plugin-details__settings">
							<SettingsPanel settings={settings} save={save} />
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
