import type { ComponentType } from "preact";

import type { PluginInfo, TrueRecallSettings } from "@true-recall/core/types";

/**
 * Props passed to a plugin's settings panel component.
 * The host (PluginsTab) provides these from its own hooks.
 */
interface PluginSettingsProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
}

/**
 * A command contributed by a plugin.
 * The host wraps each callback with an `isPluginEnabled` guard
 * and injects the plugin instance at registration time.
 */
interface PluginCommandDef {
	id: string;
	name: string;
	icon?: string;
}

/**
 * Declarative manifest for a True Recall plugin.
 * Each plugin exports one of these from its barrel index.
 */
interface PluginManifest {
	info: PluginInfo;
	settingsPanel?: ComponentType<PluginSettingsProps>;
	commands?: PluginCommandDef[];
	toolbarButtonIds?: string[];
}

export type { PluginCommandDef, PluginManifest, PluginSettingsProps };
