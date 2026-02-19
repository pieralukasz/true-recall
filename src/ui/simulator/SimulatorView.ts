import { ItemView, WorkspaceLeaf } from "obsidian";
import {
	Chart,
	CategoryScale,
	LinearScale,
	LogarithmicScale,
	LineElement,
	LineController,
	PointElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js";
import { h } from "preact";
import { VIEW_TYPE_SIMULATOR } from "../../constants";
import { mountPreact } from "../preact";
import { SimulatorApp } from "./SimulatorApp";
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
	Legend
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
		container.addClasses(["ep:overflow-y-auto", "ep:h-full", "ep:bg-obs-primary"]);

		this.unmountPreact = mountPreact(container, this.plugin, h(SimulatorApp, null));
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
