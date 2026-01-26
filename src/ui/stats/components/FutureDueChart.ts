/**
 * FutureDueChart Component
 * Bar chart showing cards due in the future
 * Click on bars to open card preview for that date
 */
import { Chart } from "chart.js";
import type { FutureDueEntry, StatsTimeRange } from "../../../types";
import { ChartSection, type ChartSectionProps } from "./ChartSection";
import type { StatsCalculatorService } from "../../../services";

export interface FutureDueChartProps extends ChartSectionProps {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview?: (date: string, cards: any[]) => void;
}

/**
 * FutureDueChart - Shows upcoming card reviews in a bar chart
 */
export class FutureDueChart extends ChartSection<FutureDueEntry> {
	protected props: FutureDueChartProps;

	constructor(container: HTMLElement, props: FutureDueChartProps) {
		super(container, {
			title: "Future due",
		});
		this.props = props;
	}

	/**
	 * Fetch future due data from stats calculator
	 */
	async fetchData(): Promise<FutureDueEntry[]> {
		return await this.props.statsCalculator.getFutureDueStatsFilled(this.props.currentRange);
	}

	/**
	 * Render the bar chart with fetched data
	 */
	renderChart(data: FutureDueEntry[]): void {
		// Destroy existing chart if present
		if (this.chart) {
			this.chart.destroy();
		}

		// Format labels to show just day/month
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
						label: "Cards Due",
						data: data.map((d) => d.count),
						backgroundColor: "rgba(59, 130, 246, 0.7)",
						borderColor: "rgb(59, 130, 246)",
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
		const avg = data.length > 0 ? Math.round(total / data.length) : 0;
		this.createSummary([
			`Total: ${total} reviews`,
			`Average: ${avg} reviews/day`,
		]);
	}

	/**
	 * Get max ticks limit for x-axis based on range
	 */
	private getMaxTicksForRange(): number {
		switch (this.props.currentRange) {
			case "1y":
				return 12; // Show ~monthly labels
			case "3m":
				return 13; // Show ~weekly labels
			case "1m":
				return 15; // Show every other day
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
}
