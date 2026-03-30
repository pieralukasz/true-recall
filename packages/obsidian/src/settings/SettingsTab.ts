import { SettingsApp } from "./SettingsApp";
import { mountPreact } from "@true-recall/obsidian/preact";
import { type App, PluginSettingTab } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../main";

export class TrueRecallSettingTab extends PluginSettingTab {
	plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(app: App, plugin: TrueRecallPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.unmountPreact?.();
		this.containerEl.empty();
		this.containerEl.addClass("ep:overflow-x-hidden");
		this.unmountPreact = mountPreact(
			this.containerEl,
			this.plugin,
			h(SettingsApp, null),
		);
	}

	hide(): void {
		this.unmountPreact?.();
		this.unmountPreact = undefined;
	}
}
