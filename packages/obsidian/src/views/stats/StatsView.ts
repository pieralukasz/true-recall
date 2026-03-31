import { VIEW_TYPE_STATS } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { StatsApp } from "@true-recall/obsidian/views/stats/StatsApp";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../main";

export class StatsView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_STATS;
	}

	getDisplayText(): string {
		return "Statistics";
	}

	getIcon(): string {
		return "bar-chart-3";
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
			container.empty();
			container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
			this.unmountPreact = mountPreact(
				container,
				this.plugin,
				h(StatsApp, null),
			);
		}
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		return Promise.resolve();
	}
}
