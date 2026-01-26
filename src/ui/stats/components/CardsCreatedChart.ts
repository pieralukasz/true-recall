/**
 * CardsCreatedChart Component
 * Bar chart showing historical card creation data
 * Click on bars to open card preview for that date
 */
import { Chart } from "chart.js";
import type { CardsCreatedEntry, StatsTimeRange } from "../../../types";
import { ChartSection, type ChartSectionProps } from "./ChartSection";
import type { StatsCalculatorService } from "../../../services";

export interface CardsCreatedChartProps extends ChartSectionProps {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview?: (date: string, cards: any[]) => void;
}

/**
 * CardsCreatedChart - Shows card creation history in a bar chart
 */
export class CardsCreatedChart extends ChartSection<CardsCreatedEntry> {
	protected props: CardsCreatedChartProps;

	constructor(container: HTMLElement, props: CardsCreatedChartProps) {
		super(container, {
			title: "Cards created",
			icon: "📝",
		});
		this.props = props;
	}

	/**
	 * Fetch cards created data from stats calculator
	 */
	async fetchData(): Promise<CardsCreatedEntry[]> {
		// Skip for "backlog" range (it's for future predictions)
		if (this.props.currentRange === "backlog") {
			return [];
		}
		return await this.props.statsCalculator.getCardsCreatedHistoryFilled(this.props.currentRange);
	}

	/**
	 * Render the bar chart with fetched data
	 */
	renderChart(data: CardsCreatedEntry[]): void {
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
						label: "Cards Created",
						data: data.map((d) => d.count),
						backgroundColor: "rgba(34, 197, 94, 0.7)", // Green for creation
						borderColor: "rgb(34, 197, 94)",
						borderWidth: 1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
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
						if (entry && entry.count > 0) {
							void this.handleDateClick(entry.date);
						}
					}
				},
			},
		});

		// Add summary section
		const total = data.reduce((sum, d) => sum + d.count, 0);
		this.createSummary([
			`Total: ${total} cards created`,
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
		const cards = await this.props.statsCalculator.getCardsCreatedOnDate(date);

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
				text: "Select a time range to see creation history",
			});
			return;
		}

		// Call parent render for normal flow
		super.render();
		await this.refresh();
	}
}
