import {
	type App,
	PluginSettingTab,
	type SettingDefinitionItem,
} from "obsidian";
import { h } from "preact";

import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../main";
import { SettingsApp } from "./SettingsApp";

export class TrueRecallSettingTab extends PluginSettingTab {
	plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(app: App, plugin: TrueRecallPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "True Recall settings",
				desc: "Configure review behavior, FSRS, data, integrations, and optional features.",
				aliases: [
					"General",
					"AI provider",
					"FSRS",
					"Review",
					"Data",
					"Backup",
					"Integrations",
					"Plugins",
					"Features",
				],
				render: (setting) => {
					setting.settingEl.empty();
					setting.settingEl.addClass("true-recall-settings-root");
					return this.mountSettings(setting.settingEl);
				},
			},
		];
	}

	display(): void {
		this.containerEl.empty();
		this.mountSettings(this.containerEl);
	}

	hide(): void {
		this.unmountPreact?.();
		this.unmountPreact = undefined;
	}

	private mountSettings(container: HTMLElement): () => void {
		this.unmountPreact?.();
		// Both mount paths (the settings tab and the search-definition renderer)
		// need this class: it scopes every rule in settings.styles.css.
		container.addClass("tr-settings");
		container.addClass("ep:overflow-x-hidden");
		const unmount = mountPreact(container, this.plugin, h(SettingsApp, null));
		this.unmountPreact = unmount;
		return () => {
			unmount();
			if (this.unmountPreact === unmount) {
				this.unmountPreact = undefined;
			}
		};
	}
}
