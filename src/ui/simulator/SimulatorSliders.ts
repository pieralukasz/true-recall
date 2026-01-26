/**
 * Simulator Sliders Component
 * Grid of parameter sliders for FSRS weights
 */
import { BaseComponent } from "../component.base";
import { ALL_SLIDERS } from "./constants";
import type { SimulatorStateManager } from "../../state/simulator.state";
import type { SliderConfig } from "./types";

interface SimulatorSlidersProps {
	stateManager: SimulatorStateManager;
	onParameterChange: () => void;
}

export class SimulatorSliders extends BaseComponent {
	private props: SimulatorSlidersProps;
	private sliderInputs: Map<number, { range: HTMLInputElement; number: HTMLInputElement }> = new Map();
	private debounceTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

	constructor(container: HTMLElement, props: SimulatorSlidersProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		this.element = this.container.createDiv({
			cls: "ep:bg-obs-secondary ep:rounded-lg ep:p-4 ep:mb-4",
		});

		// Grid for sliders
		const grid = this.element.createDiv({
			cls: "ep:grid ep:grid-cols-1 md:ep:grid-cols-2 lg:ep:grid-cols-3 ep:gap-3",
		});

		for (const config of ALL_SLIDERS) {
			this.createSliderRow(grid, config);
		}
	}

	destroy(): void {
		// Clear all debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
		super.destroy();
	}

	/**
	 * Create a single slider row
	 */
	private createSliderRow(container: HTMLElement, config: SliderConfig): void {
		const row = container.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		// Label
		row.createDiv({
			text: config.name,
			cls: "ep:w-[200px] ep:text-ui-smaller ep:text-obs-muted ep:truncate",
			attr: { title: config.description },
		});

		// Number input
		const numberInput = row.createEl("input", {
			type: "text",
			cls: [
				"ep:w-[70px] ep:px-2 ep:py-1",
				"ep:bg-obs-primary ep:text-obs-normal",
				"ep:border ep:border-obs-border ep:rounded",
				"ep:text-ui-smaller ep:text-center",
			].join(" "),
		});
		numberInput.value = this.formatValue(this.getValue(config.index), config);

		// Min label
		row.createDiv({
			text: String(config.min),
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:w-[40px] ep:text-right",
		});

		// Range slider
		const rangeInput = row.createEl("input", {
			type: "range",
			cls: "ep:flex-1 ep:cursor-pointer ep:h-1 ep:simulator-slider",
		});
		rangeInput.min = String(config.min);
		rangeInput.max = String(config.max);
		rangeInput.step = String(config.step);
		rangeInput.value = String(this.getValue(config.index));

		// Max label
		row.createDiv({
			text: String(config.max),
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:w-[40px]",
		});

		// Store references
		this.sliderInputs.set(config.index, { range: rangeInput, number: numberInput });

		// Event handlers
		this.events.addEventListener(rangeInput, "input", () => {
			const value = parseFloat(rangeInput.value);
			numberInput.value = this.formatValue(value, config);
			this.debouncedUpdate(config.index, value);
		});

		this.events.addEventListener(numberInput, "change", () => {
			let value = parseFloat(numberInput.value);
			if (isNaN(value)) {
				value = config.defaultValue;
			}
			value = Math.max(config.min, Math.min(config.max, value));
			numberInput.value = this.formatValue(value, config);
			rangeInput.value = String(value);
			this.debouncedUpdate(config.index, value);
		});

		this.events.addEventListener(numberInput, "keydown", (e: Event) => {
			if ((e as KeyboardEvent).key === "Enter") {
				numberInput.blur();
			}
		});
	}

	/**
	 * Get current value for a parameter
	 */
	private getValue(index: number): number {
		if (index === -1) {
			return this.props.stateManager.getDesiredRetention();
		}
		return this.props.stateManager.getParameters()[index] ?? 0;
	}

	/**
	 * Format value for display
	 */
	private formatValue(value: number, config: SliderConfig): string {
		// Use appropriate decimal places based on step
		const decimals = config.step < 0.01 ? 4 : config.step < 0.1 ? 2 : 1;
		return value.toFixed(decimals);
	}

	/**
	 * Debounced parameter update
	 */
	private debouncedUpdate(index: number, value: number): void {
		// Clear existing timer for this index
		const existingTimer = this.debounceTimers.get(index);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Set new timer
		const timer = setTimeout(() => {
			if (index === -1) {
				this.props.stateManager.setDesiredRetention(value);
			} else {
				this.props.stateManager.setParameter(index, value);
			}
			this.props.onParameterChange();
			this.debounceTimers.delete(index);
		}, 150);

		this.debounceTimers.set(index, timer);
	}

	/**
	 * Update slider values from state (for undo/redo)
	 */
	update(): void {
		for (const [index, inputs] of this.sliderInputs) {
			const value = this.getValue(index);
			inputs.range.value = String(value);
			const config = ALL_SLIDERS.find((c) => c.index === index);
			if (config) {
				inputs.number.value = this.formatValue(value, config);
			}
		}
	}
}
