/**
 * TodaySection Component
 * Displays today's metrics in an elegant 3x2 grid
 * Metrics: Studied, Minutes, New, Again, Correct, Streak
 */
import { BaseComponent } from "../../component.base";
import type { StatsCalculatorService } from "../../../services";
import type { StatsTimeRange } from "../../../types";

export interface TodaySectionProps {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onRangeChange?: (range: StatsTimeRange) => void;
}

/**
 * Metric data structure
 */
interface Metric {
	label: string;
	value: string;
	color?: string;
}

/**
 * TodaySection - Shows today's study statistics in a beautiful card grid
 */
export class TodaySection extends BaseComponent {
	private props: TodaySectionProps;
	private gridEl!: HTMLElement;
	private summaryEl!: HTMLElement;
	private metrics: Metric[] = [];

	constructor(container: HTMLElement, props: TodaySectionProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Main container
		this.element = this.container.createDiv({
			cls: [
				// Card styling
				"ep:mb-5",
				"ep:p-5",
				"ep:rounded-lg",
				"ep:bg-obs-secondary",
				// NO border, NO shadow - use only background color for separation
				"ep:transition-all",
				"ep:duration-200",
			].join(" "),
		});

		// Header
		const header = this.element.createDiv({
			cls: [
				"ep:flex",
				"ep:items-center",
				"ep:justify-between",
				"ep:mb-4",
				"ep:pb-3",
				"ep:border-b",
				"ep:border-obs-border", // Plain border for internal divider
			].join(" "),
		});

		header.createSpan({
			cls: [
				"ep:text-ui-large",
				"ep:font-semibold",
				"ep:text-obs-normal",
				"ep:tracking-tight",
			].join(" "),
			text: "Today",
		});

		// Grid container - 2 columns on mobile, 3 on desktop
		this.gridEl = this.element.createDiv({
			cls: [
				"ep:grid",
				"ep:gap-3",
				"ep:grid-cols-2", // 2 columns mobile
				"md:ep:grid-cols-3", // 3 columns desktop
			].join(" "),
		});

		// Summary section (below grid)
		this.summaryEl = this.element.createDiv({
			cls: [
				"ep:mt-4",
				"ep:pt-4",
				"ep:border-t",
				"ep:border-obs-border", // Plain border for internal divider
			].join(" "),
		});
	}

	/**
	 * Refresh the today section data
	 */
	async refresh(): Promise<void> {
		try {
			const summary = await this.props.statsCalculator.getTodaySummary();
			const streak = await this.props.statsCalculator.getStreakInfo();
			const rangeSummary = await this.props.statsCalculator.getRangeSummary(this.props.currentRange);

			// Build metrics array
			this.metrics = [
				{ label: "Studied", value: summary.studied.toString() },
				{ label: "Minutes", value: summary.minutes.toString() },
				{ label: "New", value: summary.newCards.toString() },
				{ label: "Again", value: summary.again.toString() },
				{ label: "Correct", value: `${Math.round(summary.correctRate * 100)}%` },
				{ label: "Streak", value: `${streak.current}d` },
			];

			// Clear and re-render grid
			this.gridEl.empty();
			this.renderMetrics();

			// Render summary info
			this.renderSummary(summary, rangeSummary);
		} catch (error) {
			console.error("Error refreshing today section:", error);
			this.renderErrorState();
		}
	}

	/**
	 * Render metric cards in the grid
	 */
	private renderMetrics(): void {
		for (const metric of this.metrics) {
			this.createMetricCard(metric);
		}
	}

	/**
	 * Create a single metric card
	 */
	private createMetricCard(metric: Metric): void {
		const card = this.gridEl.createDiv({
			cls: [
				// Layout
				"ep:flex",
				"ep:flex-col",
				"ep:items-center",
				"ep:justify-center",
				"ep:p-4",

				// Styling
				"ep:rounded-lg",
				"ep:bg-obs-primary",
				// NO border, NO shadow

				// Transitions
				"ep:transition-all",
				"ep:duration-200",

				// Hover effects
				"ep:hover:-translate-y-0.5",
				"ep:cursor-pointer",
			].join(" "),
		});

		// Value
		card.createSpan({
			cls: [
				"ep:text-3xl",
				"ep:font-bold",
				"ep:text-obs-normal",
				"ep:mb-1",
			].join(" "),
			text: metric.value,
		});

		// Label
		card.createSpan({
			cls: [
				"ep:text-ui-smaller",
				"ep:font-medium",
				"ep:text-obs-muted",
				"ep:uppercase",
				"ep:tracking-wider",
			].join(" "),
			text: metric.label,
		});
	}

	/**
	 * Render the summary section below the grid
	 */
	private renderSummary(summary: any, rangeSummary: any): void {
		this.summaryEl.empty();

		if (summary.studied === 0) {
			this.summaryEl.createDiv({
				cls: [
					"ep:text-ui-small",
					"ep:text-obs-muted",
					"ep:italic",
					"ep:text-center",
				].join(" "),
				text: "No cards have been studied today.",
			});
			return;
		}

		const summaryContent = this.summaryEl.createDiv({
			cls: [
				"ep:flex",
				"ep:flex-col",
				"ep:gap-1.5",
			].join(" "),
		});

		// Due tomorrow
		const dueTomorrowRow = summaryContent.createDiv({
			cls: [
				"ep:text-ui-small",
				"ep:text-obs-muted",
				"ep:flex",
				"ep:items-center",
				"ep:gap-2",
			].join(" "),
		});

		dueTomorrowRow.createDiv({
			cls: [
				"ep:w-1.5",
				"ep:h-1.5",
				"ep:rounded-full",
				"ep:bg-obs-interactive",
				"ep:shrink-0",
			].join(" "),
		});

		dueTomorrowRow.createSpan({
			text: `Due tomorrow: ${rangeSummary.dueTomorrow} reviews`,
		});

		// Daily load
		const dailyLoadRow = summaryContent.createDiv({
			cls: [
				"ep:text-ui-small",
				"ep:text-obs-muted",
				"ep:flex",
				"ep:items-center",
				"ep:gap-2",
			].join(" "),
		});

		dailyLoadRow.createDiv({
			cls: [
				"ep:w-1.5",
				"ep:h-1.5",
				"ep:rounded-full",
				"ep:bg-obs-interactive",
				"ep:shrink-0",
			].join(" "),
		});

		dailyLoadRow.createSpan({
			text: `Daily load: ~${rangeSummary.dailyLoad} reviews/day`,
		});
	}

	/**
	 * Render error state
	 */
	private renderErrorState(): void {
		this.gridEl.empty();
		this.summaryEl.empty();

		this.element!.createDiv({
			cls: [
				"ep:flex",
				"ep:flex-col",
				"ep:items-center",
				"ep:justify-center",
				"ep:h-32",
				"ep:text-obs-error",
				"ep:text-ui-small",
			].join(" "),
			text: "Failed to load today's statistics.",
		});
	}

	/**
	 * Update the current range and refresh
	 */
	updateRange(range: StatsTimeRange): void {
		this.props.currentRange = range;
		void this.refresh();
	}
}
