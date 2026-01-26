/**
 * CardCountsChart Component
 * Doughnut chart showing card maturity breakdown with interactive legend
 * Categories: New, Learning, Young, Mature, Suspended, Buried
 */
import { Chart } from "chart.js";
import type { CardMaturityBreakdown } from "../../../types";
import { BaseComponent } from "../../component.base";
import { StatsCard } from "./StatsCard";
import type { StatsCalculatorService } from "../../../services";

export interface CardCountsChartProps {
	statsCalculator: StatsCalculatorService;
	onCardPreview?: (category: keyof CardMaturityBreakdown, label: string, cards: any[]) => void;
}

/**
 * Legend item data structure
 */
interface LegendItem {
	label: string;
	value: number;
	color: string;
	category: keyof CardMaturityBreakdown;
}

/**
 * CardCountsChart - Shows distribution of cards by maturity level
 */
export class CardCountsChart extends BaseComponent {
	private props: CardCountsChartProps;
	private statsCard: StatsCard;
	private chart: Chart | null = null;

	// Color definitions
	private readonly colors = {
		new: "#4ade80",        // green
		learning: "#fb923c",   // orange
		young: "#3b82f6",      // blue
		mature: "#8b5cf6",     // purple
		suspended: "#6b7280",  // gray
		buried: "#9ca3af",     // lighter gray
	};

	constructor(container: HTMLElement, props: CardCountsChartProps) {
		super(container);
		this.props = props;
		this.statsCard = new StatsCard(container, {
			title: "Card counts",
			hoverLift: true,
		});
	}

	render(): void {
		// Clean up existing chart
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}

		// Render the card
		this.statsCard.render();
	}

	/**
	 * Refresh the chart data
	 */
	async refresh(): Promise<void> {
		try {
			const breakdown = await this.props.statsCalculator.getCardMaturityBreakdown();
			const activeTotal = breakdown.new + breakdown.learning + breakdown.young + breakdown.mature;
			const total = activeTotal + breakdown.suspended + breakdown.buried;

			if (total === 0) {
				this.renderEmptyState();
				return;
			}

			this.renderChart(breakdown, total);
		} catch (error) {
			console.error("Error refreshing card counts chart:", error);
			this.renderErrorState();
		}
	}

	/**
	 * Render the doughnut chart and legend
	 */
	private renderChart(breakdown: CardMaturityBreakdown, total: number): void {
		const contentContainer = this.statsCard.getContentContainer();
		contentContainer.empty();

		// Chart row with chart and legend side by side
		const chartRow = contentContainer.createDiv({
			cls: [
				"ep:flex",
				"ep:gap-8",
				"ep:items-center",
				"ep:justify-center",
			].join(" "),
		});

		// Chart container
		const canvasContainer = chartRow.createDiv({
			cls: [
				"ep:w-45",
				"ep:h-45",
				"ep:relative",
				"ep:shrink-0",
			].join(" "),
		});

		const canvas = canvasContainer.createEl("canvas", {
			cls: "ep:w-full! ep:h-full! episteme-chart-fade-in",
		});

		// Prepare chart data
		const chartData: number[] = [breakdown.new, breakdown.learning, breakdown.young, breakdown.mature];
		const chartLabels: string[] = ["New", "Learning", "Young", "Mature"];
		const chartColors: string[] = [
			"rgba(74, 222, 128, 0.8)",  // New
			"rgba(251, 146, 60, 0.8)",  // Learning
			"rgba(59, 130, 246, 0.8)",  // Young
			"rgba(139, 92, 246, 0.8)",  // Mature
		];

		// Add suspended if any
		if (breakdown.suspended > 0) {
			chartData.push(breakdown.suspended);
			chartLabels.push("Suspended");
			chartColors.push("rgba(107, 114, 128, 0.8)");
		}

		// Add buried if any
		if (breakdown.buried > 0) {
			chartData.push(breakdown.buried);
			chartLabels.push("Buried");
			chartColors.push("rgba(156, 163, 175, 0.8)");
		}

		// Create chart
		this.chart = new Chart(canvas, {
			type: "doughnut",
			data: {
				labels: chartLabels,
				datasets: [
					{
						data: chartData,
						backgroundColor: chartColors,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
				},
			},
		});

		// Legend container
		this.renderLegend(chartRow, breakdown, total);
	}

	/**
	 * Render the interactive legend
	 */
	private renderLegend(container: HTMLElement, breakdown: CardMaturityBreakdown, total: number): void {
		const legendEl = container.createDiv({
			cls: [
				"ep:flex",
				"ep:flex-col",
				"ep:gap-2",
			].join(" "),
		});

		// Build legend items
		const items: LegendItem[] = [
			{ label: "New", value: breakdown.new, color: this.colors.new, category: "new" },
			{ label: "Learning", value: breakdown.learning, color: this.colors.learning, category: "learning" },
			{ label: "Young", value: breakdown.young, color: this.colors.young, category: "young" },
			{ label: "Mature", value: breakdown.mature, color: this.colors.mature, category: "mature" },
		];

		// Add suspended if any
		if (breakdown.suspended > 0) {
			items.push({
				label: "Suspended",
				value: breakdown.suspended,
				color: this.colors.suspended,
				category: "suspended",
			});
		}

		// Add buried if any
		if (breakdown.buried > 0) {
			items.push({
				label: "Buried",
				value: breakdown.buried,
				color: this.colors.buried,
				category: "buried",
			});
		}

		// Create legend item rows
		for (const item of items) {
			const row = legendEl.createDiv({
				cls: [
					"ep:flex",
					"ep:items-center",
					"ep:gap-3",
					"ep:py-2",
					"ep:px-3",
					"ep:rounded-md",
					"ep:transition-all",
					"ep:cursor-pointer",
					// Hover effect
					"ep:hover:bg-obs-primary",
					"ep:hover:shadow-sm",
					"ep:hover:-translate-x-0.5",
				].join(" "),
			});

			// Color box
			const colorBox = row.createDiv({
				cls: [
					"ep:w-4",
					"ep:h-4",
					"ep:rounded-sm",
					"ep:shadow-sm",
					"ep:shrink-0",
				].join(" "),
			});
			colorBox.style.backgroundColor = item.color;

			// Label
			row.createSpan({
				cls: [
					"ep:text-ui-small",
					"ep:font-medium",
					"ep:text-obs-normal",
				].join(" "),
				text: item.label,
			});

			// Value with percentage
			const percentage = Math.round((item.value / total) * 100);
			row.createSpan({
				cls: [
					"ep:ml-auto",
					"ep:text-ui-small",
					"ep:font-semibold",
					"ep:text-obs-muted",
				].join(" "),
				text: `${item.value} (${percentage}%)`,
			});

			// Click handler to show cards in this category
			if (item.value > 0) {
				this.events.addEventListener(row, "click", () => {
					void this.handleCategoryClick(item.category, item.label);
				});
			}
		}
	}

	/**
	 * Handle click on a legend item
	 */
	private async handleCategoryClick(category: keyof CardMaturityBreakdown, label: string): Promise<void> {
		const cards = await this.props.statsCalculator.getCardsByCategory(category);

		if (this.props.onCardPreview) {
			this.props.onCardPreview(category, label, cards);
		}
	}

	/**
	 * Render empty state
	 */
	private renderEmptyState(): void {
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
			text: "No cards found",
		});
	}

	/**
	 * Render error state
	 */
	private renderErrorState(): void {
		const contentContainer = this.statsCard.getContentContainer();
		contentContainer.empty();

		contentContainer.createDiv({
			cls: [
				"ep:flex",
				"ep:flex-col",
				"ep:items-center",
				"ep:justify-center",
				"ep:h-52",
				"ep:text-obs-error",
				"ep:text-ui-small",
			].join(" "),
			text: "Failed to load card counts.",
		});
	}

	/**
	 * Clean up chart and card
	 */
	override destroy(): void {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
		this.statsCard.destroy();
		super.destroy();
	}
}
