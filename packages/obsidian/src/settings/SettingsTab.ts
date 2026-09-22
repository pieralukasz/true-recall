import {
	type App,
	PluginSettingTab,
	type SettingDefinitionItem,
} from "obsidian";
import { h } from "preact";

import { setLanguagePreference, t } from "@true-recall/obsidian/i18n";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../main";
import { SettingsPageContent } from "./SettingsPageContent";
import { SETTINGS_PAGES, type SettingsPageId } from "./settings-pages";

export class TrueRecallSettingTab extends PluginSettingTab {
	plugin: TrueRecallPlugin;
	private readonly mountedPages = new Map<HTMLElement, () => void>();

	constructor(app: App, plugin: TrueRecallPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		setLanguagePreference(plugin.settings.uiLanguage);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return SETTINGS_PAGES.map((page) => ({
			type: "page",
			name: t(page.name),
			desc: t(page.description),
			items: [
				{
					name: t("{0} options", [t(page.name)]),
					desc: t(page.description),
					aliases: [
						...new Set([
							...page.searchAliases,
							...page.searchAliases.map((alias) => t(alias)),
						]),
					],
					render: (setting) => {
						setting.settingEl.empty();
						return this.mountSettingsPage(setting.settingEl, page.id);
					},
				},
			],
		}));
	}

	hide(): void {
		for (const unmount of [...this.mountedPages.values()]) unmount();
	}

	private mountSettingsPage(
		container: HTMLElement,
		pageId: SettingsPageId,
	): () => void {
		this.mountedPages.get(container)?.();
		container.addClass("true-recall-settings-root");
		container.addClass("tr-settings");
		container.addClass("ep:overflow-x-hidden");
		const unmountPreact = mountPreact(
			container,
			this.plugin,
			h(SettingsPageContent, { pageId }),
		);
		let mounted = true;
		const cleanup = () => {
			if (!mounted) return;
			mounted = false;
			unmountPreact();
			if (this.mountedPages.get(container) === cleanup) {
				this.mountedPages.delete(container);
			}
		};
		this.mountedPages.set(container, cleanup);
		return cleanup;
	}
}
