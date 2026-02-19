import { ItemView, WorkspaceLeaf } from "obsidian";
import {
	Chart,
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	ArcElement,
	DoughnutController,
	LineElement,
	LineController,
	PointElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js";
import { h } from "preact";
import { VIEW_TYPE_STATS } from "../../constants";
import { mountPreact } from "../preact";
import { StatsApp } from "./StatsApp";
import type TrueRecallPlugin from "../../main";

Chart.register(
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	ArcElement,
	DoughnutController,
	LineElement,
	LineController,
	PointElement,
	Title,
	Tooltip,
	Legend,
);

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
		return "bar-chart-2";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClasses(["ep:overflow-y-auto", "ep:h-full"]);

		this.unmountPreact = mountPreact(container, this.plugin, h(StatsApp, null));
	}

	// Called from main.ts when navigating to an already-open stats view.
	// Preact tree auto-refreshes via signals, so this is intentionally a no-op.
	async refresh(): Promise<void> {}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
