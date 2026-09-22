import { TRUERECALL_PRICING_URL } from "@true-recall/core/constants";
import type { PluginTier } from "@true-recall/core/types";
import { withPluginUtm } from "@true-recall/core/utils";

import { ToggleInput } from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";
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
	return <span ref={iconRef} class="tr-plugin-row__icon" aria-hidden="true" />;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	const iconRef = useIcon("chevron-right");
	return (
		<span
			ref={iconRef}
			class={cn("tr-plugin-row__chevron", expanded && "is-expanded")}
			aria-hidden="true"
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
	const detailsId = `true-recall-feature-${info.id}-details`;

	return (
		<div
			class={cn(
				"tr-plugin-item",
				!isActive && "is-unavailable",
				isActive && !isOn && "is-disabled",
			)}
		>
			<div class="tr-plugin-row">
				<button
					type="button"
					class="tr-plugin-row__summary"
					onClick={onExpandToggle}
					aria-expanded={isExpanded}
					aria-controls={detailsId}
				>
					<PluginIcon icon={info.icon} />
					<span class="tr-plugin-row__name">{t(info.name)}</span>
					<span class="tr-plugin-row__badges">
						<span class={cn("tr-plugin-tier", TIER_BADGE_CLASS[info.tier])}>
							{t(TIER_LABEL[info.tier])}
						</span>
						{info.deprecated ? (
							<span class="tr-plugin-tier ep:bg-obs-orange/15 ep:text-obs-orange">
								{t("DEPRECATED")}
							</span>
						) : null}
					</span>
					<span class="tr-plugin-row__chevron-slot">
						<ChevronIcon expanded={isExpanded} />
					</span>
				</button>
				<span class="tr-plugin-row__control">
					{isActive ? (
						<ToggleInput
							value={isEnabled}
							onChange={onToggle}
							ariaLabel={`Enable ${t(info.name)}`}
						/>
					) : (
						<a
							class="tr-plugin-upgrade"
							href={withPluginUtm(TRUERECALL_PRICING_URL, "settings-plugins")}
							target="_blank"
							rel="noreferrer"
						>
							{t("Upgrade")}
						</a>
					)}
				</span>
			</div>

			{isExpanded ? (
				<div class="tr-plugin-details" id={detailsId}>
					<div class="tr-plugin-details__description">
						<p>{t(info.description)}</p>
						<ul class="tr-plugin-features">
							{info.features.map((feature) => (
								<li key={feature}>{t(feature)}</li>
							))}
						</ul>
						{info.deprecated ? (
							<p class="ep:text-obs-orange">{info.deprecated.message}</p>
						) : null}
						{!isActive ? (
							<div class="tr-plugin-details__locked">
								<span>
									{info.tier === "pro"
										? t("Included with True Recall Pro.")
										: t("Add an AI provider to enable this feature.")}
								</span>
								{info.tier === "pro" ? (
									<a
										class="tr-plugin-upgrade"
										href={withPluginUtm(
											TRUERECALL_PRICING_URL,
											"settings-plugins",
										)}
										target="_blank"
										rel="noreferrer"
									>
										{t("See Pro plans")}
									</a>
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
