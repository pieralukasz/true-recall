/**
 * TimeRangeSelector Component
 * Elegant time range filter buttons with active state styling
 * Ranges: Backlog, 1 Month, 3 Months, 1 Year, All
 */
import { BaseComponent } from "../../component.base";
import type { StatsTimeRange } from "../../../types";

export interface TimeRangeSelectorProps {
	currentRange: StatsTimeRange;
	onRangeChange: (range: StatsTimeRange) => void;
}

/**
 * Time range option definition
 */
interface TimeRangeOption {
	label: string;
	value: StatsTimeRange;
}

/**
 * TimeRangeSelector - Filter buttons for time ranges with elegant active state
 */
export class TimeRangeSelector extends BaseComponent {
	private props: TimeRangeSelectorProps;
	private buttons: Map<StatsTimeRange, HTMLButtonElement> = new Map();

	// Available time ranges
	private readonly ranges: TimeRangeOption[] = [
		{ label: "Backlog", value: "backlog" },
		{ label: "1 Month", value: "1m" },
		{ label: "3 Months", value: "3m" },
		{ label: "1 Year", value: "1y" },
		{ label: "All", value: "all" },
	];

	constructor(container: HTMLElement, props: TimeRangeSelectorProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
			this.buttons.clear();
		}

		// Button group container
		this.element = this.container.createDiv({
			cls: [
				"ep:flex",
				"ep:items-center",
				"ep:gap-2",
				"ep:mb-5",
				"ep:flex-wrap",
			].join(" "),
		});

		// Create buttons
		for (const range of this.ranges) {
			this.createButton(range);
		}

		// Set initial active state
		this.updateActiveState();
	}

	/**
	 * Create a single range button
	 */
	private createButton(option: TimeRangeOption): void {
		const btn = this.element!.createEl("button", {
			text: option.label,
			cls: this.getButtonClasses(option.value === this.props.currentRange),
		});

		// Store button reference
		this.buttons.set(option.value, btn);

		// Add click handler
		this.events.addEventListener(btn, "click", () => {
			if (option.value !== this.props.currentRange) {
				this.props.onRangeChange(option.value);
			}
		});
	}

	/**
	 * Get button classes based on active state
	 */
	private getButtonClasses(isActive: boolean): string {
		const baseClasses = [
			// Padding and shape
			"ep:py-2",
			"ep:px-4",
			"ep:rounded-lg",

			// Typography
			"ep:text-ui-small",
			"ep:font-medium",

			// Transitions
			"ep:transition-all",
			"ep:duration-200",

			// Cursor
			"ep:cursor-pointer",
		];

		if (isActive) {
			return [
				...baseClasses,
				// Active state styling - NO border, NO shadow
				"ep:bg-obs-interactive",
				"ep:text-white",
			].join(" ");
		}

		return [
			...baseClasses,
			// Default state styling - NO border, NO shadow
			"ep:bg-obs-secondary",
			"ep:text-obs-muted",

			// Hover state
			"ep:hover:bg-obs-modifier-hover",
			"ep:hover:text-obs-normal",
			"ep:hover:-translate-y-px",
		].join(" ");
	}

	/**
	 * Update the active state of all buttons
	 */
	private updateActiveState(): void {
		for (const [range, button] of this.buttons.entries()) {
			const isActive = range === this.props.currentRange;

			// Remove all state classes first
			button.className = "";

			// Re-apply classes
			button.className = this.getButtonClasses(isActive);
		}
	}

	/**
	 * Update the current range and refresh UI
	 */
	updateRange(range: StatsTimeRange): void {
		this.props.currentRange = range;
		this.updateActiveState();
	}
}
