import { StatsApp } from "@features/metrics/ui/stats/StatsApp";
import { VIEW_TYPE_STATS } from "@shared/constants";
import { mountPreact } from "@shared/ui/preact";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../../../main";

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

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClasses([
			"ep:overflow-y-auto",
			"ep:h-full",
			"ep:bg-obs-primary",
		]);

		this.unmountPreact = mountPreact(container, this.plugin, h(StatsApp, null));
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
