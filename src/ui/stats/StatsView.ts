/**
 * Statistics View
 * Displays comprehensive statistics similar to Anki's stats panel
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import {
	Chart,
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	ArcElement,
	DoughnutController,
	Title,
	Tooltip,
	Legend,
} from "chart.js";
import { VIEW_TYPE_STATS } from "../../constants";
import { StatsCalculatorService } from "../../services/stats-calculator.service";
import { CardPreviewModal } from "../modals";
import type EpistemePlugin from "../../main";
import type { StatsTimeRange, CardMaturityBreakdown, FutureDueEntry } from "../../types";

// Register Chart.js components
Chart.register(
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	ArcElement,
	DoughnutController,
	Title,
	Tooltip,
	Legend
);

export class StatsView extends ItemView {
	private plugin: EpistemePlugin;
	private statsCalculator: StatsCalculatorService;
	private charts: Map<string, Chart> = new Map();
	private currentRange: StatsTimeRange = "1m";

	// Data for click handlers
	private futureDueData: FutureDueEntry[] = [];

	// Container elements
	private todayEl!: HTMLElement;
	private rangeSelectorEl!: HTMLElement;
	private futureDueEl!: HTMLElement;
	private cardCountsEl!: HTMLElement;
	private calendarEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.statsCalculator = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence
		);
	}

	getViewType(): string {
		return VIEW_TYPE_STATS;
	}

	getDisplayText(): string {
		return "Statistics";
	}

	getIcon(): string {
		return "bar-chart-2";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("episteme-stats");

		// Create section containers
		this.createSections(container);

		// Initial render
		await this.refresh();
	}

	async onClose(): Promise<void> {
		// Destroy all charts to prevent memory leaks
		for (const chart of this.charts.values()) {
			chart.destroy();
		}
		this.charts.clear();
	}

	private createSections(container: HTMLElement): void {
		// 1. Today Summary Section
		this.todayEl = container.createDiv({ cls: "episteme-stats-section stats-today" });

		// 2. Time Range Selector
		this.rangeSelectorEl = container.createDiv({ cls: "episteme-stats-range-selector" });
		this.createRangeButtons();

		// 3. Future Due Section (bar chart)
		this.futureDueEl = container.createDiv({ cls: "episteme-stats-section stats-future" });

		// 4. Card Counts Section (pie chart)
		this.cardCountsEl = container.createDiv({ cls: "episteme-stats-section stats-counts" });

		// 5. Calendar Heatmap Section
		this.calendarEl = container.createDiv({ cls: "episteme-stats-section stats-calendar" });
	}

	private createRangeButtons(): void {
		const ranges: { label: string; value: StatsTimeRange }[] = [
			{ label: "Backlog", value: "backlog" },
			{ label: "1 Month", value: "1m" },
			{ label: "3 Months", value: "3m" },
			{ label: "1 Year", value: "1y" },
			{ label: "All", value: "all" },
		];

		for (const range of ranges) {
			const btn = this.rangeSelectorEl.createEl("button", {
				text: range.label,
				cls: `episteme-stats-range-btn ${this.currentRange === range.value ? "active" : ""}`,
			});
			btn.addEventListener("click", () => void this.setRange(range.value));
		}
	}

	private async setRange(range: StatsTimeRange): Promise<void> {
		this.currentRange = range;

		// Update button states
		const buttons = this.rangeSelectorEl.querySelectorAll(".episteme-stats-range-btn");
		const rangeOrder: StatsTimeRange[] = ["backlog", "1m", "3m", "1y", "all"];
		buttons.forEach((btn, i) => {
			btn.classList.toggle("active", rangeOrder[i] === range);
		});

		// Re-render charts
		await this.renderFutureDueChart();
	}

	async refresh(): Promise<void> {
		await Promise.all([
			this.renderTodaySummary(),
			this.renderFutureDueChart(),
			this.renderCardCountsChart(),
			this.renderCalendarHeatmap(),
		]);
	}

	// ===== Section Renderers =====

	private async renderTodaySummary(): Promise<void> {
		this.todayEl.empty();
		this.todayEl.createEl("h3", { text: "Today" });

		const summary = await this.statsCalculator.getTodaySummary();
		const streak = await this.statsCalculator.getStreakInfo();
		const rangeSummary = await this.statsCalculator.getRangeSummary(this.currentRange);

		if (summary.studied === 0) {
			this.todayEl.createDiv({
				cls: "stats-today-empty",
				text: "No cards have been studied today.",
			});
		}

		const grid = this.todayEl.createDiv({ cls: "stats-today-grid" });

		this.createStatCard(grid, "Studied", summary.studied.toString());
		this.createStatCard(grid, "Minutes", summary.minutes.toString());
		this.createStatCard(grid, "New", summary.newCards.toString());
		this.createStatCard(grid, "Again", summary.again.toString());
		this.createStatCard(grid, "Correct", `${Math.round(summary.correctRate * 100)}%`);
		this.createStatCard(grid, "Streak", `${streak.current}d`);

		// Additional summary
		const summaryEl = this.todayEl.createDiv({ cls: "stats-today-summary" });
		summaryEl.createDiv({ text: `Due tomorrow: ${rangeSummary.dueTomorrow} reviews` });
		summaryEl.createDiv({ text: `Daily load: ~${rangeSummary.dailyLoad} reviews/day` });
	}

	private createStatCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createDiv({ cls: "stats-card" });
		card.createDiv({ cls: "stats-card-value", text: value });
		card.createDiv({ cls: "stats-card-label", text: label });
	}

	private async renderFutureDueChart(): Promise<void> {
		this.futureDueEl.empty();
		this.futureDueEl.createEl("h3", { text: "Future Due" });

		// Create all elements synchronously BEFORE async calls to prevent race conditions
		const canvasContainer = this.futureDueEl.createDiv({ cls: "stats-chart-container" });
		const canvas = canvasContainer.createEl("canvas", { cls: "stats-chart-canvas" });
		const summaryEl = this.futureDueEl.createDiv({ cls: "stats-chart-summary" });

		// Use filled version for proper day-by-day display
		const data = await this.statsCalculator.getFutureDueStatsFilled(this.currentRange);
		this.futureDueData = data; // Store for click handler

		if (data.length === 0) {
			this.futureDueEl.empty();
			this.futureDueEl.createEl("h3", { text: "Future Due" });
			this.futureDueEl.createDiv({
				cls: "stats-no-data",
				text: "No data available",
			});
			return;
		}

		// Destroy existing chart if present
		if (this.charts.has("futureDue")) {
			this.charts.get("futureDue")!.destroy();
		}

		// Format labels to show just day/month
		const labels = data.map((d) => {
			const date = new Date(d.date);
			return `${date.getDate()}/${date.getMonth() + 1}`;
		});

		// Calculate maxTicksLimit based on range
		const maxTicks = this.getMaxTicksForRange();

		const chart = new Chart(canvas, {
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
							void this.openCardPreviewForDate(entry.date);
						}
					}
				},
			},
		});
		this.charts.set("futureDue", chart);

		// Fill the summary element (already created synchronously above)
		const total = data.reduce((sum, d) => sum + d.count, 0);
		const avg = data.length > 0 ? Math.round(total / data.length) : 0;
		summaryEl.createDiv({ text: `Total: ${total} reviews` });
		summaryEl.createDiv({ text: `Average: ${avg} reviews/day` });
	}

	private getMaxTicksForRange(): number {
		switch (this.currentRange) {
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

	private formatDateForDisplay(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString(undefined, {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	private async openCardPreviewForDate(date: string): Promise<void> {
		const cards = await this.statsCalculator.getCardsDueOnDate(date);
		new CardPreviewModal(this.plugin.app, {
			title: `Cards due: ${this.formatDateForDisplay(date)}`,
			cards,
		}).open();
	}

	private async renderCardCountsChart(): Promise<void> {
		this.cardCountsEl.empty();
		this.cardCountsEl.createEl("h3", { text: "Card Counts" });

		const breakdown = await this.statsCalculator.getCardMaturityBreakdown();
		const activeTotal = breakdown.new + breakdown.learning + breakdown.young + breakdown.mature;
		const total = activeTotal + breakdown.suspended;

		if (total === 0) {
			this.cardCountsEl.createDiv({
				cls: "stats-no-data",
				text: "No cards found",
			});
			return;
		}

		const chartRow = this.cardCountsEl.createDiv({ cls: "stats-counts-row" });

		// Chart (only active cards, suspended shown separately)
		const canvasContainer = chartRow.createDiv({ cls: "stats-chart-container-small" });
		const canvas = canvasContainer.createEl("canvas", { cls: "stats-chart-canvas-small" });

		if (this.charts.has("cardCounts")) {
			this.charts.get("cardCounts")!.destroy();
		}

		const chartData = [breakdown.new, breakdown.learning, breakdown.young, breakdown.mature];
		const chartLabels = ["New", "Learning", "Young", "Mature"];
		const chartColors = [
			"rgba(74, 222, 128, 0.8)", // New - green
			"rgba(251, 146, 60, 0.8)", // Learning - orange
			"rgba(59, 130, 246, 0.8)", // Young - blue
			"rgba(139, 92, 246, 0.8)", // Mature - purple
		];

		// Add suspended to chart if any
		if (breakdown.suspended > 0) {
			chartData.push(breakdown.suspended);
			chartLabels.push("Suspended");
			chartColors.push("rgba(107, 114, 128, 0.8)"); // Suspended - gray
		}

		const chart = new Chart(canvas, {
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
		this.charts.set("cardCounts", chart);

		// Legend with percentages - clickable
		const legendEl = chartRow.createDiv({ cls: "stats-counts-legend" });
		const items: { label: string; value: number; color: string; category: keyof CardMaturityBreakdown }[] = [
			{ label: "New", value: breakdown.new, color: "#4ade80", category: "new" },
			{ label: "Learning", value: breakdown.learning, color: "#fb923c", category: "learning" },
			{ label: "Young", value: breakdown.young, color: "#3b82f6", category: "young" },
			{ label: "Mature", value: breakdown.mature, color: "#8b5cf6", category: "mature" },
		];

		// Add suspended to legend if any
		if (breakdown.suspended > 0) {
			items.push({ label: "Suspended", value: breakdown.suspended, color: "#6b7280", category: "suspended" });
		}

		for (const item of items) {
			const row = legendEl.createDiv({ cls: "stats-legend-item stats-legend-clickable" });
			row.createSpan({ cls: "stats-legend-color" }).style.backgroundColor = item.color;
			row.createSpan({ text: `${item.label}` });
			row.createSpan({
				cls: "stats-legend-value",
				text: `${item.value} (${Math.round((item.value / total) * 100)}%)`,
			});

			// Click handler to show cards in this category
			if (item.value > 0) {
				row.addEventListener("click", () => {
					void this.openCardPreviewForCategory(item.category, item.label);
				});
			}
		}
	}

	private async openCardPreviewForCategory(
		category: keyof CardMaturityBreakdown,
		label: string
	): Promise<void> {
		const cards = await this.statsCalculator.getCardsByCategory(category);
		new CardPreviewModal(this.plugin.app, {
			title: `${label} Cards (${cards.length})`,
			cards,
		}).open();
	}

	private async renderCalendarHeatmap(): Promise<void> {
		this.calendarEl.empty();
		this.calendarEl.createEl("h3", { text: "Activity Calendar" });

		const allStats = await this.statsCalculator.sessionPersistence.getAllDailyStats();

		// Header with year navigation
		const today = new Date();
		const yearLabel = this.calendarEl.createDiv({ cls: "stats-calendar-year" });
		yearLabel.createEl("span", { text: today.getFullYear().toString() });

		// Create calendar grid (last 365 days, 53 weeks x 7 days)
		const calendarGrid = this.calendarEl.createDiv({ cls: "stats-calendar-grid" });

		// Day labels (Mon, Wed, Fri)
		const dayLabels = this.calendarEl.createDiv({ cls: "stats-calendar-day-labels" });
		for (const day of ["", "Mon", "", "Wed", "", "Fri", ""]) {
			dayLabels.createSpan({ text: day });
		}

		// Calculate starting point (53 weeks ago, aligned to Sunday)
		const startDate = new Date(today);
		startDate.setDate(startDate.getDate() - 364);
		// Align to Sunday
		const dayOfWeek = startDate.getDay();
		startDate.setDate(startDate.getDate() - dayOfWeek);

		// Create grid by weeks (columns) then days (rows)
		for (let week = 0; week < 53; week++) {
			const weekColumn = calendarGrid.createDiv({ cls: "stats-calendar-week" });

			for (let day = 0; day < 7; day++) {
				const cellDate = new Date(startDate);
				cellDate.setDate(cellDate.getDate() + week * 7 + day);

				const dateKey = cellDate.toISOString().split("T")[0]!;
				const stats = allStats[dateKey];
				const count = stats?.reviewsCompleted ?? 0;

				const cell = weekColumn.createDiv({
					cls: `stats-calendar-cell ${this.getHeatmapLevel(count)}`,
				});

				// Only show cells for dates up to today
				if (cellDate > today) {
					cell.addClass("future");
				}

				// Tooltip
				cell.setAttribute("aria-label", `${dateKey}: ${count} reviews`);
				cell.setAttribute("title", `${dateKey}: ${count} reviews`);
			}
		}

		// Legend
		const legend = this.calendarEl.createDiv({ cls: "stats-calendar-legend" });
		legend.createSpan({ text: "Less" });
		for (let i = 0; i <= 4; i++) {
			legend.createDiv({ cls: `stats-calendar-cell level-${i}` });
		}
		legend.createSpan({ text: "More" });
	}

	private getHeatmapLevel(count: number): string {
		if (count === 0) return "level-0";
		if (count < 10) return "level-1";
		if (count < 25) return "level-2";
		if (count < 50) return "level-3";
		return "level-4";
	}
}
