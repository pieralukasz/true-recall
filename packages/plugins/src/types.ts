import type { App, Workspace } from "obsidian";
import type { ComponentType } from "preact";

import type { TrueRecallApp } from "@true-recall/core/app/TrueRecallApp";
import type { PluginInfo, TrueRecallSettings } from "@true-recall/core/types";

import type { DataLayer } from "@true-recall/obsidian/data/data-layer";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

/**
 * Props passed to a plugin's settings panel component.
 * The host (PluginsTab) provides these from its own hooks.
 */
interface PluginSettingsProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
}

type Cleanup = () => void;

/** Runtime context passed to a plugin's activate function. */
interface PluginContext {
	obsidianPlugin: TrueRecallPlugin;
	app: App;
	workspace: Workspace;
	trueRecallApp: TrueRecallApp;
	dataLayer: DataLayer;
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
}

/**
 * Declarative manifest for a True Recall plugin.
 * Each plugin exports one of these from its barrel index.
 */
interface PluginManifest {
	info: PluginInfo;
	settingsPanel?: ComponentType<PluginSettingsProps>;
	toolbarButtonIds?: string[];
	activate?: (ctx: PluginContext) => Cleanup | void;
	deactivate?: () => void;
}

export type { Cleanup, PluginContext, PluginManifest, PluginSettingsProps };
