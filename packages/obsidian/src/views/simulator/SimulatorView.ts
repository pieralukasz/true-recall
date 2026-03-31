import { VIEW_TYPE_SIMULATOR } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { SimulatorApp } from "@true-recall/obsidian/views/simulator/SimulatorApp";
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
import type TrueRecallPlugin from "../../main";

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
		return "FSRS simulator";
	}

	getIcon(): string {
		return "activity";
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
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
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		return Promise.resolve();
	}
}
