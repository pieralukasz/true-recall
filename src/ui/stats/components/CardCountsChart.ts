/**
 * CardCountsChart Component
 * Doughnut chart showing card maturity breakdown with interactive legend
 * Categories: New, Learning, Young, Mature, Suspended, Buried
 */
import { Chart } from "chart.js";
import type { CardMaturityBreakdown, FSRSFlashcardItem } from "../../../types";
import { BaseComponent } from "../../component.base";
import { StatsCard } from "./StatsCard";
import type { StatsCalculatorService } from "../../../services";
import { getThemeColor } from "../../utils/theme-colors";

export interface CardCountsChartProps {
	statsCalculator: StatsCalculatorService;
	onCardPreview?: (category: keyof CardMaturityBreakdown, label: string, cards: FSRSFlashcardItem[]) => void;
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

	private getColors() {
		return {
			new: getThemeColor("--color-green"),
			learning: getThemeColor("--color-orange"),
			young: getThemeColor("--color-blue"),
			mature: getThemeColor("--color-purple"),
			suspended: getThemeColor("--text-faint"),
			buried: getThemeColor("--text-muted"),
		};
	}

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
			const breakdown = this.props.statsCalculator.getCardMaturityBreakdown();
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
		const colors = this.getColors();
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
			cls: "ep:w-full! ep:h-full! true-recall-chart-fade-in",
		});

		// Prepare chart data
		const chartData: number[] = [breakdown.new, breakdown.learning, breakdown.young, breakdown.mature];
		const chartLabels: string[] = ["New", "Learning", "Young", "Mature"];
		const chartColors: string[] = [
			colors.new,
			colors.learning,
			colors.young,
			colors.mature,
		];

		// Add suspended if any
		if (breakdown.suspended > 0) {
			chartData.push(breakdown.suspended);
			chartLabels.push("Suspended");
			chartColors.push(colors.suspended);
		}

		// Add buried if any
		if (breakdown.buried > 0) {
			chartData.push(breakdown.buried);
			chartLabels.push("Buried");
			chartColors.push(colors.buried);
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
		const colors = this.getColors();
		const legendEl = container.createDiv({
			cls: [
				"ep:flex",
				"ep:flex-col",
				"ep:gap-2",
			].join(" "),
		});

		// Build legend items
		const items: LegendItem[] = [
			{ label: "New", value: breakdown.new, color: colors.new, category: "new" },
			{ label: "Learning", value: breakdown.learning, color: colors.learning, category: "learning" },
			{ label: "Young", value: breakdown.young, color: colors.young, category: "young" },
			{ label: "Mature", value: breakdown.mature, color: colors.mature, category: "mature" },
		];

		// Add suspended if any
		if (breakdown.suspended > 0) {
			items.push({
				label: "Suspended",
				value: breakdown.suspended,
				color: colors.suspended,
				category: "suspended",
			});
		}

		// Add buried if any
		if (breakdown.buried > 0) {
			items.push({
				label: "Buried",
				value: breakdown.buried,
				color: colors.buried,
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
					"ep:hover:-translate-x-0.5",
				].join(" "),
			});

			// Color box
			const colorBox = row.createDiv({
				cls: [
					"ep:w-4",
					"ep:h-4",
					"ep:rounded-sm",
					"ep:shrink-0",
				].join(" "),
			});
			colorBox.addClass("ep-dynamic-bg");
			colorBox.style.setProperty("--ep-dynamic-color", item.color);

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
	private handleCategoryClick(category: keyof CardMaturityBreakdown, label: string): void {
		const cards = this.props.statsCalculator.getCardsByCategory(category);

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
