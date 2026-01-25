/**
 * Simulator Chart Component
 * Chart.js line chart for visualizing FSRS simulations
 */
import { Chart, type ChartConfiguration } from "chart.js";
import { BaseComponent } from "../component.base";
import { GRADE_NAMES } from "./constants";
import type { SimulatorStateManager } from "../../state/simulator.state";
import type { MetricType, SequenceSimulation, SequenceReview } from "./types";

interface SimulatorChartProps {
	stateManager: SimulatorStateManager;
}

export class SimulatorChart extends BaseComponent {
	private props: SimulatorChartProps;
	private chart: Chart | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private legendEl: HTMLElement | null = null;

	constructor(container: HTMLElement, props: SimulatorChartProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		this.element = this.container.createDiv({
			cls: "ep:bg-obs-secondary ep:rounded-lg ep:p-4 ep:mb-4",
		});

		// Legend at top
		this.legendEl = this.element.createDiv({
			cls: "ep:flex ep:flex-wrap ep:gap-3 ep:mb-4 ep:justify-end",
		});

		// Chart container
		const chartContainer = this.element.createDiv({
			cls: "ep:relative ep:h-[350px]",
		});

		this.canvas = chartContainer.createEl("canvas");
		this.createChart();
	}

	update(): void {
		this.updateLegend();
		this.updateChartData();
	}

	destroy(): void {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
		super.destroy();
	}

	/**
	 * Create the Chart.js instance
	 */
	private createChart(): void {
		if (!this.canvas) return;

		const simulations = this.props.stateManager.getSimulations();
		const metricType = this.props.stateManager.getMetricType();
		const useLogarithmic = this.props.stateManager.getUseLogarithmic();
		const useAnimation = this.props.stateManager.getUseAnimation();

		const config = this.createChartConfig(
			simulations,
			metricType,
			useLogarithmic,
			useAnimation
		);

		this.chart = new Chart(this.canvas, config);
		this.updateLegend();
	}

	/**
	 * Update chart data without recreating
	 */
	private updateChartData(): void {
		if (!this.chart) return;

		const simulations = this.props.stateManager.getSimulations();
		const metricType = this.props.stateManager.getMetricType();
		const useLogarithmic = this.props.stateManager.getUseLogarithmic();
		const useAnimation = this.props.stateManager.getUseAnimation();

		// Get max review count
		const maxReviews = Math.max(
			...simulations.map((s) => s.reviews.length),
			1
		);

		// Update labels
		this.chart.data.labels = Array.from(
			{ length: maxReviews },
			(_, i) => i
		);

		// Update datasets
		this.chart.data.datasets = simulations.map((sim) => ({
			label: sim.sequence,
			data: this.getMetricData(sim.reviews, metricType),
			borderColor: sim.color,
			backgroundColor: `${sim.color}40`,
			tension: 0.2,
			pointRadius: 5,
			pointHoverRadius: 8,
			pointBackgroundColor: sim.color,
		}));

		// Update scale type
		if (this.chart.options.scales?.y) {
			const yScale = this.chart.options.scales.y as any;
			yScale.type = useLogarithmic ? "logarithmic" : "linear";
			yScale.title = {
				display: true,
				text: this.getMetricLabel(metricType),
			};
		}

		// Update animation
		this.chart.options.animation = useAnimation
			? { duration: 400 }
			: false;

		this.chart.update(useAnimation ? "default" : "none");
	}

	/**
	 * Update the legend
	 */
	private updateLegend(): void {
		if (!this.legendEl) return;
		this.legendEl.empty();

		const simulations = this.props.stateManager.getSimulations();

		for (const sim of simulations) {
			const item = this.legendEl.createDiv({
				cls: "ep:flex ep:items-center ep:gap-1.5",
			});

			// Color box
			item.createDiv({
				cls: "ep:w-4 ep:h-4 ep:rounded",
			}).style.backgroundColor = sim.color;

			// Label
			item.createSpan({
				text: sim.sequence,
				cls: "ep:text-sm ep:text-obs-muted",
			});
		}
	}

	/**
	 * Create chart configuration
	 */
	private createChartConfig(
		simulations: SequenceSimulation[],
		metricType: MetricType,
		useLogarithmic: boolean,
		useAnimation: boolean
	): ChartConfiguration<"line"> {
		const maxReviews = Math.max(
			...simulations.map((s) => s.reviews.length),
			1
		);

		return {
			type: "line",
			data: {
				labels: Array.from({ length: maxReviews }, (_, i) => i),
				datasets: simulations.map((sim) => ({
					label: sim.sequence,
					data: this.getMetricData(sim.reviews, metricType),
					borderColor: sim.color,
					backgroundColor: `${sim.color}40`,
					tension: 0.2,
					pointRadius: 5,
					pointHoverRadius: 8,
					pointBackgroundColor: sim.color,
				})),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: useAnimation ? { duration: 400 } : false,
				interaction: {
					intersect: false,
					mode: "index",
				},
				plugins: {
					legend: {
						display: false, // We use custom legend
					},
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const sim = simulations[ctx.datasetIndex];
								const review = sim?.reviews[ctx.dataIndex];
								if (!review) return ctx.formattedValue;

								const gradeName = GRADE_NAMES[review.grade] || "N/A";
								const diffPct = (review.difficulty * 10).toFixed(0);
								return `${sim.sequence}: ${ctx.formattedValue} (${gradeName}, D: ${diffPct}%)`;
							},
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: "Review Number",
						},
						ticks: {
							stepSize: 1,
						},
					},
					y: {
						type: useLogarithmic ? "logarithmic" : "linear",
						beginAtZero: true,
						title: {
							display: true,
							text: this.getMetricLabel(metricType),
						},
					},
				},
			},
		};
	}

	/**
	 * Extract metric data from reviews
	 */
	private getMetricData(
		reviews: SequenceReview[],
		metricType: MetricType
	): number[] {
		return reviews.map((r) => {
			switch (metricType) {
				case "interval":
					return r.interval;
				case "stability":
					return r.stability;
				case "difficulty":
					return r.difficulty;
				case "cumulative":
					return r.cumulativeInterval;
				default:
					return r.interval;
			}
		});
	}

	/**
	 * Get label for metric type
	 */
	private getMetricLabel(metricType: MetricType): string {
		switch (metricType) {
			case "interval":
				return "Interval (days)";
			case "stability":
				return "Stability";
			case "difficulty":
				return "Difficulty (0-10)";
			case "cumulative":
				return "Cumulative Interval (days)";
			default:
				return "Value";
		}
	}
}
