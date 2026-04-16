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

const DOCS_BASE = "https://docs.truerecall.com/plugins";

function DocsLink({ pluginId }: { pluginId: string }) {
	const iconRef = useIcon("external-link");
	return (
		<a
			href={`${DOCS_BASE}/${pluginId}`}
			target="_blank"
			rel="noopener noreferrer"
			class="ep:inline-flex ep:items-center ep:gap-1 ep:text-[11px] ep:text-obs-accent ep:hover:underline"
			onClick={(e) => e.stopPropagation()}
		>
			Documentation
			<span ref={iconRef} class="ep:w-3 ep:h-3" />
		</a>
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
	const isActive = isPro || !info.requiresPro;
	const isOn = isActive && isEnabled;
	const canExpand = isOn;

	const SettingsPanel = manifest.settingsPanel;

	return (
		<div
			class={cn(
				"ep:border ep:border-obs-border ep:rounded-lg ep:transition-all",
				!isActive && "ep:opacity-50",
				isActive && !isOn && "ep:opacity-70",
			)}
		>
			<Clickable
				class={cn(
					"ep:px-4 ep:py-2.5 ep:w-full ep:text-left",
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
				<div class="ep:flex ep:items-center ep:justify-between ep:gap-3">
					<div class="ep:flex ep:items-center ep:gap-2.5">
						<PluginIcon icon={info.icon} />
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{info.name}
						</div>
						<span
							class={cn(
								"ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:rounded ep:font-medium",
								info.requiresPro
									? "ep:bg-obs-accent/10 ep:text-obs-accent"
									: "ep:bg-green-500/15 ep:text-green-600",
							)}
						>
							{info.requiresPro ? "PRO" : "FREE"}
						</span>
						{canExpand && <ChevronIcon expanded={isExpanded} />}
					</div>

					{isActive ? (
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
							Upgrade
						</Clickable>
					)}
				</div>
			</Clickable>

			{isExpanded && (
				<div class="ep:border-t ep:border-obs-border ep:flex ep:flex-col">
					<div class="ep:py-3 ep:px-6 ep:flex ep:flex-col ep:gap-1.5">
						<p class="ep:text-[12px] ep:text-obs-muted ep:leading-relaxed">
							{info.description}
						</p>
						<DocsLink pluginId={info.id} />
					</div>
					{SettingsPanel && (
						<div class="ep:px-4 ep:pb-2">
							<SettingsPanel settings={settings} save={save} />
						</div>
					)}
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
		<FormCard title="Plugins" description="">
			<div class="ep:flex ep:flex-col ep:gap-1.5">
				{[...PLUGIN_MANIFESTS]
					.sort(
						(a, b) => Number(a.info.requiresPro) - Number(b.info.requiresPro),
					)
					.map((manifest) => (
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
