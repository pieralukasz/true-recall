import type { PluginInfo } from "@true-recall/core/types";

import {
	Clickable,
	FormCard,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import { useSettings } from "../hooks/useSettings";
import { ALL_PLUGINS } from "@true-recall/plugins";

function PluginIcon({ icon }: { icon: string }) {
	const iconRef = useIcon(icon);
	return <span ref={iconRef} class="ep:w-5 ep:h-5 ep:text-obs-accent" />;
}

interface PluginCardProps {
	plugin: PluginInfo;
	isPro: boolean;
	isEnabled: boolean;
	onToggle: (enabled: boolean) => void;
}

function PluginCard({ plugin, isPro, isEnabled, onToggle }: PluginCardProps) {
	const isActive = isPro && isEnabled;

	return (
		<div
			class={cn(
				"ep:border ep:border-obs-border ep:rounded-lg ep:p-4 ep:transition-colors",
				isActive ? "ep:bg-obs-primary" : "ep:bg-obs-secondary/50",
			)}
		>
			<div class="ep:flex ep:items-start ep:justify-between ep:gap-3">
				<div class="ep:flex ep:items-center ep:gap-2.5">
					<PluginIcon icon={plugin.icon} />
					<div>
						<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
							{plugin.name}
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
					</div>
				</div>

				{isPro ? (
					<ToggleInput value={isEnabled} onChange={onToggle} />
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
				{plugin.description}
			</p>

			<ul class="ep:list-none ep:p-0 ep:m-0 ep:flex ep:flex-col ep:gap-1">
				{plugin.features.map((feature: string) => (
					<li
						key={feature}
						class="ep:text-ui-smaller ep:text-obs-muted ep:flex ep:items-start ep:gap-1.5"
					>
						<span class="ep:text-obs-accent ep:mt-0.5 ep:shrink-0">•</span>
						{feature}
					</li>
				))}
			</ul>
		</div>
	);
}

export function PluginsTab() {
	const { settings, save } = useSettings();
	const isPro = !!settings.proKey;
	const pluginStates = settings.pluginStates ?? {};

	const handleToggle = (pluginId: string, enabled: boolean) => {
		void save({
			pluginStates: { ...pluginStates, [pluginId]: enabled },
		});
	};

	return (
		<FormCard
			title="Plugins"
			description="Pro features available with True Recall Pro."
		>
			<div class="ep:flex ep:flex-col ep:gap-3">
				{ALL_PLUGINS.map((plugin) => (
					<PluginCard
						key={plugin.id}
						plugin={plugin}
						isPro={isPro}
						isEnabled={pluginStates[plugin.id] !== false}
						onToggle={(enabled) => handleToggle(plugin.id, enabled)}
					/>
				))}
			</div>
		</FormCard>
	);
}
