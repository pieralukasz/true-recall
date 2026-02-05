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
import { VIEW_TYPE_SIMULATOR } from "../../constants";
import { FSRSSimulatorService } from "../../services/core/fsrs-simulator.service";
import { SimulatorChart } from "./SimulatorChart";
import { SimulatorControls } from "./SimulatorControls";
import { SimulatorSliders } from "./SimulatorSliders";
import { SimulatorResultsTable } from "./SimulatorResultsTable";
import type TrueRecallPlugin from "../../main";
import type { SimulatorApi } from "../../state/store";

// Register Chart.js components
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
	private simulatorService: FSRSSimulatorService;

	// Child components
	private chart: SimulatorChart | null = null;
	private controls: SimulatorControls | null = null;
	private sliders: SimulatorSliders | null = null;
	private resultsTable: SimulatorResultsTable | null = null;

	// Parameters bar elements
	private paramsDisplay: HTMLElement | null = null;
	private undoBtn: HTMLButtonElement | null = null;
	private redoBtn: HTMLButtonElement | null = null;

	// Unsubscribers
	private stateUnsubscribe: (() => void) | null = null;

	// Debounce timer
	private updateTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.simulatorService = new FSRSSimulatorService();
	}

	private get simulator(): SimulatorApi {
		return this.plugin.store!.getState().simulator;
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

		// Main wrapper
		const wrapper = container.createDiv({
			cls: "ep:p-2 ep:max-w-[1400px] ep:mx-auto",
		});

		// Header
		this.createHeader(wrapper);

		// Main content: left panel + chart area
		const mainContent = wrapper.createDiv({
			cls: "ep:flex ep:gap-4 ep:mb-4",
		});

		// Left panel (controls)
		const leftPanel = mainContent.createDiv({
			cls: "ep:w-[220px] ep:flex-shrink-0",
		});

		// Right panel (chart + sliders)
		const rightPanel = mainContent.createDiv({
			cls: "ep:flex-1 ep:min-w-0",
		});

		// Create components
		this.controls = new SimulatorControls(leftPanel, {
			simulator: this.simulator,
			onSequencesChange: () => this.scheduleUpdate(),
			onMetricChange: () => this.updateChart(),
			onOptionsChange: () => this.updateChart(),
		});
		this.controls.render();

		this.chart = new SimulatorChart(rightPanel, {
			simulator: this.simulator,
		});
		this.chart.render();

		// Parameters bar (under chart, full width) - shows params string + Reset/Undo/Redo
		this.createParametersBar(wrapper);

		// Sliders section (full width)
		const slidersContainer = wrapper.createDiv();
		this.sliders = new SimulatorSliders(slidersContainer, {
			simulator: this.simulator,
			onParameterChange: () => this.scheduleUpdate(),
		});
		this.sliders.render();

		// Results table (full width, below everything)
		const tableContainer = wrapper.createDiv();
		this.resultsTable = new SimulatorResultsTable(tableContainer, {
			simulator: this.simulator,
		});
		this.resultsTable.render();

		// Subscribe to state changes
		this.stateUnsubscribe = this.plugin.store!.subscribe(
			(state) => state.simulator.simulations,
			() => this.resultsTable?.update()
		);

		// Initial simulation
		this.runSimulation();
	}

	async onClose(): Promise<void> {
		// Cleanup timer
		if (this.updateTimer) {
			clearTimeout(this.updateTimer);
			this.updateTimer = null;
		}

		// Cleanup state subscription
		if (this.stateUnsubscribe) {
			this.stateUnsubscribe();
			this.stateUnsubscribe = null;
		}

		// Destroy components
		this.chart?.destroy();
		this.controls?.destroy();
		this.sliders?.destroy();
		this.resultsTable?.destroy();
	}

	private createHeader(container: HTMLElement): void {
		const header = container.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:mb-4",
		});

		// Title
		header.createEl("h2", {
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
			text: "FSRS 6",
			cls: "ep:text-xl ep:font-bold ep:text-obs-normal ep:m-0",
		});

		// Legend will be rendered by the chart component
	}

	private scheduleUpdate(): void {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer);
		}
		this.updateTimer = setTimeout(() => {
			this.runSimulation();
			this.updateTimer = null;
		}, 100);
	}

	private runSimulation(): void {
		const sequences = this.simulator.getSequences();
		const parameters = this.simulator.getParameters();
		const retention = this.simulator.getDesiredRetention();

		const simulations = this.simulatorService.simulate(
			sequences,
			parameters,
			retention
		);

		this.simulator.setSimulations(simulations);
		this.chart?.update();
		this.updateParametersDisplay();
		this.updateUndoRedoButtons();
	}

	private updateChart(): void {
		this.chart?.update();
	}

	private createParametersBar(container: HTMLElement): void {
		const bar = container.createDiv({
			cls: "ep:mb-4",
		});

		// Parameters string display (full width, no scroll)
		this.paramsDisplay = bar.createDiv({
			cls: [
				"ep:text-ui-smaller ep:text-obs-muted",
				"ep:bg-obs-secondary ep:p-2 ep:rounded",
				"ep:font-mono ep:mb-2",
			].join(" "),
		});

		// Buttons row
		const buttonsContainer = bar.createDiv({
			cls: "ep:flex ep:gap-2 ep:items-center",
		});

		// Reset parameters button
		const resetBtn = buttonsContainer.createEl("button", {
			text: "Reset parameters",
			cls: this.getButtonCls(),
		});
		resetBtn.addEventListener("click", () => {
			this.simulator.resetParameters();
			this.scheduleUpdate();
			this.sliders?.update();
		});

		// Undo button
		this.undoBtn = buttonsContainer.createEl("button", {
			text: "Undo",
			cls: this.getButtonCls(),
		});
		this.undoBtn.addEventListener("click", () => {
			this.simulator.undo();
			this.scheduleUpdate();
			this.sliders?.update();
		});

		// Redo button
		this.redoBtn = buttonsContainer.createEl("button", {
			text: "Redo",
			cls: this.getButtonCls(),
		});
		this.redoBtn.addEventListener("click", () => {
			this.simulator.redo();
			this.scheduleUpdate();
			this.sliders?.update();
		});

		// Page indicator
		buttonsContainer.createDiv({
			text: "1 / 1",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2",
		});
	}

	private getButtonCls(): string {
		return [
			"ep:px-3 ep:py-1.5",
			"ep:bg-obs-secondary ep:text-obs-normal",
			"ep:border ep:border-obs-border ep:rounded",
			"ep:cursor-pointer ep:text-ui-smaller",
			"hover:ep:bg-obs-modifier-hover",
		].join(" ");
	}

	private updateParametersDisplay(): void {
		if (this.paramsDisplay) {
			this.paramsDisplay.setText(this.simulator.getParametersString());
		}
	}

	private updateUndoRedoButtons(): void {
		if (this.undoBtn) {
			this.undoBtn.disabled = !this.simulator.canUndo();
			this.undoBtn.classList.toggle("ep:opacity-50", !this.simulator.canUndo());
		}
		if (this.redoBtn) {
			this.redoBtn.disabled = !this.simulator.canRedo();
			this.redoBtn.classList.toggle("ep:opacity-50", !this.simulator.canRedo());
		}
	}
}
