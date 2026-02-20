import {
	CategoryScale,
	Chart,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	LogarithmicScale,
	PointElement,
	Title,
	Tooltip,
} from "chart.js";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import { VIEW_TYPE_SIMULATOR } from "../../../../shared/constants";
import type TrueRecallPlugin from "../../../../main";
import { mountPreact } from "../../../../shared/ui/preact";
import { SimulatorApp } from "./SimulatorApp";

// Register Chart.js components before any Preact rendering
Chart.register(
	CategoryScale,
	LinearScale,
	LogarithmicScale,
	LineElement,
	LineController,
	PointElement,
	Title,
	Tooltip,
	Legend,
);

export class SimulatorView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_SIMULATOR;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
		return "FSRS simulator";
	}

	getIcon(): string {
		return "activity";
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

		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(SimulatorApp, null),
		);
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
