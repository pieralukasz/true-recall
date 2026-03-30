import { DashboardApp } from "@true-recall/obsidian/views/dashboard/DashboardApp";
import { VIEW_TYPE_DASHBOARD } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../main";

export class DashboardView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return "Dashboard";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClasses(["ep:h-full", "ep:overflow-hidden"]);

		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(DashboardApp, null),
		);
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
