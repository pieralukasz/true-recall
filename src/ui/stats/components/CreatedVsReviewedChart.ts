/**
 * CreatedVsReviewedChart Component
 * Grouped bar chart comparing cards created vs reviewed
 * Shows three metrics: Created, Reviewed, Created & Reviewed Same Day
 */
import { Chart } from "chart.js";
import type { CardsCreatedVsReviewedEntry, StatsTimeRange } from "../../../types";
import { ChartSection, type ChartSectionProps } from "./ChartSection";
import type { StatsCalculatorService } from "../../../services";

export interface CreatedVsReviewedChartProps extends ChartSectionProps {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview?: (date: string, cards: any[]) => void;
}

/**
 * CreatedVsReviewedChart - Compares creation and review activity
 */
export class CreatedVsReviewedChart extends ChartSection<CardsCreatedVsReviewedEntry> {
	protected props: CreatedVsReviewedChartProps;

	constructor(container: HTMLElement, props: CreatedVsReviewedChartProps) {
		super(container, {
			title: "Created vs Reviewed",
			icon: "📊",
		});
		this.props = props;
	}

	/**
	 * Fetch created vs reviewed data from stats calculator
	 */
	async fetchData(): Promise<CardsCreatedVsReviewedEntry[]> {
		// Skip for "backlog" range
		if (this.props.currentRange === "backlog") {
			return [];
		}
		return await this.props.statsCalculator.getCardsCreatedVsReviewedHistory(this.props.currentRange);
	}

	/**
	 * Render the grouped bar chart with fetched data
	 */
	renderChart(data: CardsCreatedVsReviewedEntry[]): void {
		// Destroy existing chart if present
		if (this.chart) {
			this.chart.destroy();
		}

		// Format labels
		const labels = data.map((d) => {
			const date = new Date(d.date);
			return `${date.getDate()}/${date.getMonth() + 1}`;
		});

		// Calculate maxTicksLimit based on range
		const maxTicks = this.getMaxTicksForRange();

		// Create chart
		this.chart = new Chart(this.canvas, {
			type: "bar",
			data: {
				labels,
				datasets: [
					{
						label: "Created",
						data: data.map((d) => d.created),
						backgroundColor: "rgba(34, 197, 94, 0.7)", // Green
						borderColor: "rgb(34, 197, 94)",
						borderWidth: 1,
					},
					{
						label: "Reviewed",
						data: data.map((d) => d.reviewed),
						backgroundColor: "rgba(59, 130, 246, 0.7)", // Blue
						borderColor: "rgb(59, 130, 246)",
						borderWidth: 1,
					},
					{
						label: "Created & Reviewed Same Day",
						data: data.map((d) => d.createdAndReviewedSameDay),
						backgroundColor: "rgba(251, 146, 60, 0.8)", // Orange
						borderColor: "rgb(251, 146, 60)",
						borderWidth: 1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: true, position: "top" },
					tooltip: {
						callbacks: {
							title: (items) => {
								if (items.length > 0) {
									const index = items[0]!.dataIndex;
									return this.formatDateForDisplay(data[index]!.date);
								}
								return "";
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: { precision: 0 },
					},
					x: {
						ticks: {
							maxRotation: 45,
							minRotation: 45,
							maxTicksLimit: maxTicks,
						},
					},
				},
				onClick: (_event, elements) => {
					if (elements.length > 0) {
						const index = elements[0]!.index;
						const entry = data[index];
						if (entry && (entry.created > 0 || entry.reviewed > 0)) {
							void this.handleDateClick(entry.date);
						}
					}
				},
			},
		});

		// Add summary section
		const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
		const totalReviewed = data.reduce((sum, d) => sum + d.reviewed, 0);
		this.createSummary([
			`Total created: ${totalCreated} cards`,
			`Total reviewed: ${totalReviewed} cards`,
		]);
	}

	/**
	 * Get max ticks limit for x-axis based on range
	 */
	private getMaxTicksForRange(): number {
		switch (this.props.currentRange) {
			case "1y":
				return 12;
			case "3m":
				return 13;
			case "1m":
				return 15;
			default:
				return 30;
		}
	}

	/**
	 * Format date for display in tooltip
	 */
	private formatDateForDisplay(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString(undefined, {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	/**
	 * Handle click on a date bar
	 */
	private async handleDateClick(date: string): Promise<void> {
		// For now, open cards due on date (same as future due)
		const cards = await this.props.statsCalculator.getCardsDueOnDate(date);

		if (this.props.onCardPreview) {
			this.props.onCardPreview(date, cards);
		}
	}

	/**
	 * Update the current range and refresh
	 */
	updateRange(range: StatsTimeRange): void {
		this.props.currentRange = range;
		void this.refresh();
	}

	/**
	 * Override render to show message for backlog range
	 */
	override async render(): Promise<void> {
		if (this.props.currentRange === "backlog") {
			// Render card with message
			this.statsCard.render();
			const contentContainer = this.statsCard.getContentContainer();
			contentContainer.empty();
			contentContainer.createDiv({
				cls: [
					"ep:flex",
					"ep:flex-col",
					"ep:items-center",
					"ep:justify-center",
					"ep:h-52",
					"ep:text-obs-muted",
					"ep:text-ui-small",
					"ep:italic",
				].join(" "),
				text: "Select a time range to see comparison",
			});
			return;
		}

		// Call parent render for normal flow
		super.render();
		await this.refresh();
	}
}
