/**
 * RetentionChart Component
 * Line chart showing retention rate over time
 */
import { Chart } from "chart.js";
import type { RetentionEntry, StatsTimeRange } from "../../../types";
import { ChartSection, type ChartSectionProps } from "./ChartSection";
import type { StatsCalculatorService } from "../../../services";

export interface RetentionChartProps extends ChartSectionProps {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
}

/**
 * RetentionChart - Shows retention rate percentage over time
 */
export class RetentionChart extends ChartSection<RetentionEntry> {
	protected props: RetentionChartProps;

	constructor(container: HTMLElement, props: RetentionChartProps) {
		super(container, {
			title: "Retention rate",
			icon: "📈",
		});
		this.props = props;
	}

	/**
	 * Fetch retention data from stats calculator
	 */
	async fetchData(): Promise<RetentionEntry[]> {
		return await this.props.statsCalculator.getRetentionHistory(this.props.currentRange);
	}

	/**
	 * Render the line chart with fetched data
	 */
	renderChart(data: RetentionEntry[]): void {
		// Destroy existing chart if present
		if (this.chart) {
			this.chart.destroy();
		}

		// Format labels to show day/month
		const labels = data.map((d) => {
			const date = new Date(d.date);
			return `${date.getDate()}/${date.getMonth() + 1}`;
		});

		// Calculate maxTicksLimit based on range
		const maxTicks = this.getMaxTicksForRange();

		// Create chart
		this.chart = new Chart(this.canvas, {
			type: "line",
			data: {
				labels,
				datasets: [
					{
						label: "Retention %",
						data: data.map((d) => d.retention),
						borderColor: "rgb(34, 197, 94)",
						backgroundColor: "rgba(34, 197, 94, 0.1)",
						fill: true,
						tension: 0.3,
						pointRadius: data.length > 30 ? 0 : 3,
						pointHoverRadius: 5,
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
							label: (context) => {
								const index = context.dataIndex;
								const entry = data[index];
								return entry ? `${entry.retention}% (${entry.total} reviews)` : "";
							},
						},
					},
				},
				scales: {
					y: {
						min: 0,
						max: 100,
						ticks: {
							callback: (value) => `${value}%`,
						},
					},
					x: {
						ticks: {
							maxRotation: 45,
							minRotation: 45,
							maxTicksLimit: maxTicks,
						},
					},
				},
			},
		});

		// Add summary section
		const avgRetention = data.length > 0
			? Math.round(data.reduce((sum, d) => sum + d.retention, 0) / data.length)
			: 0;
		const totalReviews = data.reduce((sum, d) => sum + d.total, 0);
		this.createSummary([
			`Average: ${avgRetention}%`,
			`Total reviews: ${totalReviews}`,
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
	 * Update the current range and refresh
	 */
	updateRange(range: StatsTimeRange): void {
		this.props.currentRange = range;
		void this.refresh();
	}
}
