import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_DASHBOARD } from "@true-recall/core/constants";

import { mountPreact } from "@true-recall/obsidian/preact";
import { DashboardApp } from "@true-recall/obsidian/views/dashboard/DashboardApp";
import { createViewVisibility } from "@true-recall/obsidian/views/view-visibility";

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

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
			container.empty();
			container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
			this.unmountPreact = mountPreact(
				container,
				this.plugin,
				h(DashboardApp, { isViewVisible: createViewVisibility(this) }),
			);
		}
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		return Promise.resolve();
	}
}
