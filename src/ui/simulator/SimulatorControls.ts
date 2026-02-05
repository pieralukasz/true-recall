/**
 * Simulator Controls Component
 * Left panel with sequence input and display options
 */
import { BaseComponent } from "../component.base";
import type { SimulatorApi } from "../../state/store";
import type { MetricType } from "./types";

interface SimulatorControlsProps {
	simulator: SimulatorApi;
	onSequencesChange: () => void;
	onMetricChange: () => void;
	onOptionsChange: () => void;
}

export class SimulatorControls extends BaseComponent {
	private props: SimulatorControlsProps;
	private textarea: HTMLTextAreaElement | null = null;

	constructor(container: HTMLElement, props: SimulatorControlsProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		this.element = this.container.createDiv({
			cls: "ep:bg-obs-secondary ep:rounded-lg ep:p-4",
		});

		// Reset reviews button
		const resetReviewsBtn = this.element.createEl("button", {
			text: "Reset reviews",
			cls: [
				"ep:w-full ep:mb-3 ep:px-3 ep:py-2",
				"ep:bg-obs-primary ep:text-obs-normal",
				"ep:border ep:border-obs-border ep:rounded",
				"ep:cursor-pointer ep:text-ui-small",
				"hover:ep:bg-obs-modifier-hover",
			].join(" "),
		});
		this.events.addEventListener(resetReviewsBtn, "click", () => {
			this.props.simulator.resetSequences();
			this.updateTextarea();
			this.props.onSequencesChange();
		});

		// Info text
		this.element.createDiv({
			text: "1=Again, 2=Hard, 3=Good, 4=Easy",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mb-2",
		});

		// Textarea for sequences
		this.textarea = this.element.createEl("textarea", {
			cls: [
				"ep:w-full ep:h-[150px] ep:mb-4",
				"ep:bg-obs-primary ep:text-obs-normal",
				"ep:border ep:border-obs-border ep:rounded",
				"ep:p-2 ep:text-ui-small ep:font-mono",
				"ep:resize-none",
			].join(" "),
		});
		this.updateTextarea();
		this.events.addEventListener(this.textarea, "input", () => {
			this.handleTextareaChange();
		});

		// Metric type radio buttons
		this.createMetricRadios();

		// Option checkboxes
		this.createOptionCheckboxes();
	}

	/**
	 * Update textarea from state
	 */
	private updateTextarea(): void {
		if (this.textarea) {
			this.textarea.value = this.props.simulator
				.getSequences()
				.join("\n");
		}
	}

	/**
	 * Handle textarea changes
	 */
	private handleTextareaChange(): void {
		if (!this.textarea) return;

		const lines = this.textarea.value
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && /^[1-4]+$/.test(line));

		if (lines.length > 0) {
			this.props.simulator.setSequences(lines);
			this.props.onSequencesChange();
		}
	}

	/**
	 * Create metric type radio buttons
	 */
	private createMetricRadios(): void {
		const metricGroup = this.element!.createDiv({
			cls: "ep:mb-4",
		});

		const metrics: { value: MetricType; label: string }[] = [
			{ value: "interval", label: "Interval" },
			{ value: "stability", label: "Stability" },
			{ value: "difficulty", label: "Difficulty" },
			{ value: "cumulative", label: "CumulativeInterval" },
		];

		const currentMetric = this.props.simulator.getMetricType();

		for (const metric of metrics) {
			const label = metricGroup.createEl("label", {
				cls: "ep:flex ep:items-center ep:gap-2 ep:mb-1 ep:cursor-pointer ep:text-ui-small",
			});

			const radio = label.createEl("input", {
				type: "radio",
				cls: "ep:cursor-pointer",
			});
			radio.name = "metric-type";
			radio.value = metric.value;
			radio.checked = metric.value === currentMetric;

			this.events.addEventListener(radio, "change", () => {
				if (radio.checked) {
					this.props.simulator.setMetricType(metric.value);
					this.props.onMetricChange();
				}
			});

			label.createSpan({
				text: metric.label,
				cls: "ep:text-obs-normal",
			});
		}
	}

	/**
	 * Create option checkboxes
	 */
	private createOptionCheckboxes(): void {
		const optionsGroup = this.element!.createDiv();

		// Animation checkbox
		const animLabel = optionsGroup.createEl("label", {
			cls: "ep:flex ep:items-center ep:gap-2 ep:mb-1 ep:cursor-pointer ep:text-ui-small",
		});
		const animCheckbox = animLabel.createEl("input", {
			type: "checkbox",
			cls: "ep:cursor-pointer",
		});
		animCheckbox.checked = this.props.simulator.getUseAnimation();
		this.events.addEventListener(animCheckbox, "change", () => {
			this.props.simulator.setUseAnimation(animCheckbox.checked);
			this.props.onOptionsChange();
		});
		animLabel.createSpan({
			text: "Animation",
			cls: "ep:text-obs-normal",
		});

		// Logarithmic checkbox
		const logLabel = optionsGroup.createEl("label", {
			cls: "ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-small",
		});
		const logCheckbox = logLabel.createEl("input", {
			type: "checkbox",
			cls: "ep:cursor-pointer",
		});
		logCheckbox.checked = this.props.simulator.getUseLogarithmic();
		this.events.addEventListener(logCheckbox, "change", () => {
			this.props.simulator.setUseLogarithmic(logCheckbox.checked);
			this.props.onOptionsChange();
		});
		logLabel.createSpan({
			text: "Logarithmic",
			cls: "ep:text-obs-normal",
		});
	}
}
