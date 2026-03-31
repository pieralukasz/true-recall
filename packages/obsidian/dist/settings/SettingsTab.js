import { SettingsApp } from "./SettingsApp";
import { mountPreact } from "@true-recall/obsidian/preact";
import { PluginSettingTab } from "obsidian";
import { h } from "preact";
export class TrueRecallSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        var _a;
        (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        this.containerEl.empty();
        this.containerEl.addClass("ep:overflow-x-hidden");
        this.unmountPreact = mountPreact(this.containerEl, this.plugin, h(SettingsApp, null));
    }
    hide() {
        var _a;
        (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        this.unmountPreact = undefined;
    }
}
