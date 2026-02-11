/**
 * ReviewsChart Component
 * Unified chart showing cards created and reviewed with toggleable datasets
 * Similar to Anki's "Reviews" statistics chart
 */
import { Chart, type ChartDataset } from "chart.js";
import type { CardsCreatedVsReviewedEntry, FSRSFlashcardItem, StatsTimeRange } from "../../../types";
import { ChartSection, type ChartSectionProps } from "./ChartSection";
import type { StatsCalculatorService } from "../../../services";
import { getThemeColor, getThemeColorWithAlpha } from "../../utils/theme-colors";

export interface ReviewsChartProps extends ChartSectionProps {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
	onCardPreview?: (date: string, cards: FSRSFlashcardItem[]) => void;
}

interface DatasetVisibility {
	created: boolean;
	reviewed: boolean;
	createdAndReviewedSameDay: boolean;
}

/**
 * ReviewsChart - Unified chart with toggleable datasets for creation and review activity
 */
export class ReviewsChart extends ChartSection<CardsCreatedVsReviewedEntry> {
	protected props: ReviewsChartProps;
	private controlsContainer: HTMLElement | null = null;
	private visibility: DatasetVisibility = {
		created: false, // Off by default
		reviewed: true, // On by default (like Anki)
		createdAndReviewedSameDay: false, // Off by default
	};

	constructor(container: HTMLElement, props: ReviewsChartProps) {
		super(container, {
			title: "Reviews",
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
		return this.props.statsCalculator.getCardsCreatedVsReviewedHistory(this.props.currentRange);
	}

	/**
	 * Override render to add toggle controls
	 */
	override render(): void {
		// Clean up existing chart if any
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}

		// Render the card
		this.statsCard.render();

		// Get content container from card
		const contentContainer = this.statsCard.getContentContainer();

		// Create controls container for checkboxes
		this.controlsContainer = contentContainer.createDiv({
			cls: [
				"ep:flex",
				"ep:flex-wrap",
				"ep:gap-4",
				"ep:justify-center",
				"ep:mb-3",
				"ep:pb-3",
				"ep:border-b",
				"ep:border-obs-border",
			].join(" "),
		});

		this.renderControls();

		// Create canvas container with fixed height
		const canvasContainer = contentContainer.createDiv({
			cls: ["ep:w-full", "ep:h-52", "ep:relative"].join(" "),
		});

		// Create canvas element
		this.canvas = canvasContainer.createEl("canvas", {
			cls: "true-recall-chart-fade-in",
		});
	}

	/**
	 * Render toggle checkboxes for each dataset
	 */
	private renderControls(): void {
		if (!this.controlsContainer) return;
		this.controlsContainer.empty();

		const datasets: Array<{
			key: keyof DatasetVisibility;
			label: string;
			color: string;
		}> = [
			{ key: "reviewed", label: "Reviewed", color: getThemeColorWithAlpha("--color-blue", 0.9) },
			{ key: "created", label: "Created", color: getThemeColorWithAlpha("--color-green", 0.9) },
			{ key: "createdAndReviewedSameDay", label: "Same Day", color: getThemeColorWithAlpha("--color-orange", 0.9) },
		];

		for (const { key, label, color } of datasets) {
			const checkboxWrapper = this.controlsContainer.createDiv({
				cls: [
					"ep:flex",
					"ep:items-center",
					"ep:gap-1.5",
					"ep:cursor-pointer",
					"ep:select-none",
				].join(" "),
			});

			const checkbox = checkboxWrapper.createEl("input", {
				type: "checkbox",
				cls: "ep:cursor-pointer",
			});
			checkbox.checked = this.visibility[key];
			checkbox.addClass("ep-dynamic-accent");
			checkbox.style.setProperty("--ep-dynamic-color", color);

			const labelEl = checkboxWrapper.createEl("label", {
				text: label,
				cls: [
					"ep:text-ui-small",
					"ep:cursor-pointer",
				].join(" "),
			});
			labelEl.addClass("ep-dynamic-color");
			labelEl.style.setProperty("--ep-dynamic-color", this.visibility[key] ? color : "var(--text-muted)");

			// Toggle visibility on click
			const toggleVisibility = () => {
				this.visibility[key] = !this.visibility[key];
				checkbox.checked = this.visibility[key];
				labelEl.style.setProperty("--ep-dynamic-color", this.visibility[key] ? color : "var(--text-muted)");
				this.updateChart();
			};

			checkbox.addEventListener("change", toggleVisibility);
			labelEl.addEventListener("click", (e) => {
				e.preventDefault();
				toggleVisibility();
			});
		}
	}

	/**
	 * Update chart visibility without refetching data
	 */
	private updateChart(): void {
		if (this.data.length > 0) {
			this.renderChart(this.data);
		}
	}

	/**
	 * Render the bar chart with fetched data
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

		// Build datasets based on visibility
		const datasets: ChartDataset<"bar", number[]>[] = [];

		if (this.visibility.reviewed) {
			datasets.push({
				label: "Reviewed",
				data: data.map((d) => d.reviewed),
				backgroundColor: getThemeColorWithAlpha("--color-blue", 0.7),
				borderColor: getThemeColor("--color-blue"),
				borderWidth: 1,
			});
		}

		if (this.visibility.created) {
			datasets.push({
				label: "Created",
				data: data.map((d) => d.created),
				backgroundColor: getThemeColorWithAlpha("--color-green", 0.7),
				borderColor: getThemeColor("--color-green"),
				borderWidth: 1,
			});
		}

		if (this.visibility.createdAndReviewedSameDay) {
			datasets.push({
				label: "Same Day",
				data: data.map((d) => d.createdAndReviewedSameDay),
				backgroundColor: getThemeColorWithAlpha("--color-orange", 0.8),
				borderColor: getThemeColor("--color-orange"),
				borderWidth: 1,
			});
		}

		// Create chart
		this.chart = new Chart(this.canvas, {
			type: "bar",
			data: {
				labels,
				datasets,
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false }, // Using custom controls instead
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

		// Calculate and show summary
		this.renderSummary(data);
	}

	/**
	 * Render summary statistics below the chart
	 */
	private renderSummary(data: CardsCreatedVsReviewedEntry[]): void {
		const totalReviewed = data.reduce((sum, d) => sum + d.reviewed, 0);
		const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
		const daysStudied = data.filter((d) => d.reviewed > 0).length;
		const totalDays = data.length;
		const percentStudied = totalDays > 0 ? ((daysStudied / totalDays) * 100).toFixed(1) : "0";
		const avgPerDay = totalDays > 0 ? Math.round(totalReviewed / totalDays) : 0;
		const avgPerStudyDay = daysStudied > 0 ? Math.round(totalReviewed / daysStudied) : 0;

		const summaryItems: string[] = [
			`Days studied: ${daysStudied} of ${totalDays} (${percentStudied}%)`,
			`Total: ${totalReviewed.toLocaleString()} reviews`,
			`Average over period: ${avgPerDay} reviews/day`,
		];

		if (daysStudied > 0 && daysStudied !== totalDays) {
			summaryItems.push(`Average for days studied: ${avgPerStudyDay} reviews/day`);
		}

		if (this.visibility.created) {
			summaryItems.push(`Total created: ${totalCreated.toLocaleString()} cards`);
		}

		this.createSummary(summaryItems);
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
	private handleDateClick(date: string): void {
		const cards = this.props.statsCalculator.getCardsDueOnDate(date);

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
	override async refresh(): Promise<void> {
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
				text: "Select a time range to see reviews",
			});
			return;
		}

		// Fetch data and render
		try {
			this.data = await this.fetchData();

			if (this.data.length === 0) {
				this.renderEmptyState();
				return;
			}

			// Make sure controls exist before rendering chart
			if (!this.controlsContainer) {
				this.render();
			}

			this.renderChart(this.data);
		} catch (error) {
			console.error(`Error refreshing chart:`, error);
			this.renderErrorState(error instanceof Error ? error.message : "Unknown error");
		}
	}
}
