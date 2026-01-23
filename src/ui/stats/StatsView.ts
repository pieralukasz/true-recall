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
	LineElement,
	LineController,
	PointElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js";
import { VIEW_TYPE_STATS } from "../../constants";
import { StatsCalculatorService, getEventBus } from "../../services";
import { CardPreviewModal } from "../modals";
import { NLQueryPanel } from "./NLQueryPanel";
import type EpistemePlugin from "../../main";
import type { StatsTimeRange, CardMaturityBreakdown, FutureDueEntry, CardsCreatedEntry, CardsCreatedVsReviewedEntry, RetentionEntry } from "../../types";
import type { CardReviewedEvent, CardAddedEvent, CardRemovedEvent, CardUpdatedEvent, BulkChangeEvent, StoreSyncedEvent } from "../../types/events.types";

// Register Chart.js components
Chart.register(
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	ArcElement,
	DoughnutController,
	LineElement,
	LineController,
	PointElement,
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
	private cardsCreatedData: CardsCreatedEntry[] = [];
	private createdVsReviewedData: CardsCreatedVsReviewedEntry[] = [];

	// Event subscriptions for cross-component reactivity
	private eventUnsubscribers: (() => void)[] = [];
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	// Container elements
	private todayEl!: HTMLElement;
	private rangeSelectorEl!: HTMLElement;
	private futureDueEl!: HTMLElement;
	private cardsCreatedEl!: HTMLElement;
	private createdVsReviewedEl!: HTMLElement;
	private retentionEl!: HTMLElement;
	private cardCountsEl!: HTMLElement;
	private calendarEl!: HTMLElement;
	private nlQueryEl!: HTMLElement;

	// NL Query Panel
	private nlQueryPanel: NLQueryPanel | null = null;

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
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("episteme-stats");

		// Create section containers
		this.createSections(container);

		// Subscribe to EventBus for cross-component reactivity
		this.subscribeToEvents();

		// Set SQLite store for optimized queries (like Created vs Reviewed chart)
		const sqliteStore = this.plugin.getSqliteStore();
		if (sqliteStore) {
			this.statsCalculator.setSqliteStore(sqliteStore);
		}

		// Initial render
		await this.refresh();
	}

	async onClose(): Promise<void> {
		// Cleanup refresh timer
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		// Cleanup EventBus subscriptions
		this.eventUnsubscribers.forEach((unsub) => unsub());
		this.eventUnsubscribers = [];

		// Destroy all charts to prevent memory leaks
		for (const chart of this.charts.values()) {
			chart.destroy();
		}
		this.charts.clear();
	}

	/**
	 * Subscribe to EventBus events for cross-component reactivity
	 * Uses debouncing to avoid excessive re-renders during rapid reviews
	 */
	private subscribeToEvents(): void {
		const eventBus = getEventBus();

		// Refresh stats when cards are reviewed (debounced)
		const unsubReviewed = eventBus.on<CardReviewedEvent>("card:reviewed", () => {
			this.scheduleRefresh();
		});
		this.eventUnsubscribers.push(unsubReviewed);

		// Refresh when cards are added
		const unsubAdded = eventBus.on<CardAddedEvent>("card:added", () => {
			this.scheduleRefresh();
		});
		this.eventUnsubscribers.push(unsubAdded);

		// Refresh when cards are removed
		const unsubRemoved = eventBus.on<CardRemovedEvent>("card:removed", () => {
			this.scheduleRefresh();
		});
		this.eventUnsubscribers.push(unsubRemoved);

		// Refresh for bulk changes
		const unsubBulk = eventBus.on<BulkChangeEvent>("cards:bulk-change", () => {
			this.scheduleRefresh();
		});
		this.eventUnsubscribers.push(unsubBulk);

		// Refresh when cards are updated (suspended, buried, etc.)
		const unsubUpdated = eventBus.on<CardUpdatedEvent>("card:updated", (event) => {
			// Only refresh for changes that affect stats (not just content edits)
			if (event.changes.fsrs || event.changes.suspended || event.changes.buried) {
				this.scheduleRefresh();
			}
		});
		this.eventUnsubscribers.push(unsubUpdated);

		// Refresh after store sync
		const unsubSynced = eventBus.on<StoreSyncedEvent>("store:synced", () => {
			void this.refresh();
		});
		this.eventUnsubscribers.push(unsubSynced);
	}

	/**
	 * Schedule a debounced refresh to avoid excessive re-renders
	 */
	private scheduleRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = setTimeout(() => {
			void this.refresh();
			this.refreshTimer = null;
		}, 500);
	}

	private createSections(container: HTMLElement): void {
		// 1. Today Summary Section
		this.todayEl = container.createDiv({ cls: "episteme-stats-section stats-today" });

		// 2. NL Query Section (AI-powered) - Learning Insights
		this.nlQueryEl = container.createDiv({ cls: "episteme-stats-section stats-nl-query" });
		this.nlQueryPanel = new NLQueryPanel(this.nlQueryEl, this.app, this);
		this.nlQueryPanel.render();

		// Set NL Query Service if available
		if (this.plugin.nlQueryService) {
			this.nlQueryPanel.setService(this.plugin.nlQueryService);
		}

		// 3. Time Range Selector
		this.rangeSelectorEl = container.createDiv({ cls: "episteme-stats-range-selector" });
		this.createRangeButtons();

		// 4. Future Due Section (bar chart)
		this.futureDueEl = container.createDiv({ cls: "episteme-stats-section stats-future" });

		// 5. Cards Created Section (bar chart - historical)
		this.cardsCreatedEl = container.createDiv({ cls: "episteme-stats-section stats-created" });

		// 6. Created vs Reviewed Section (grouped bar chart)
		this.createdVsReviewedEl = container.createDiv({ cls: "episteme-stats-section stats-created-vs-reviewed" });

		// 7. Retention Rate Section (line chart)
		this.retentionEl = container.createDiv({ cls: "episteme-stats-section stats-retention" });

		// 8. Card Counts Section (pie chart)
		this.cardCountsEl = container.createDiv({ cls: "episteme-stats-section stats-counts" });

		// 9. Calendar Heatmap Section
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
		await Promise.all([
			this.renderFutureDueChart(),
			this.renderCardsCreatedChart(),
			this.renderCreatedVsReviewedChart(),
			this.renderRetentionChart(),
		]);
	}

	async refresh(): Promise<void> {
		await Promise.all([
			this.renderTodaySummary(),
			this.renderFutureDueChart(),
			this.renderCardsCreatedChart(),
			this.renderCreatedVsReviewedChart(),
			this.renderRetentionChart(),
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
		this.futureDueEl.createEl("h3", { text: "Future due" });

		// Create all elements synchronously BEFORE async calls to prevent race conditions
		const canvasContainer = this.futureDueEl.createDiv({ cls: "stats-chart-container" });
		const canvas = canvasContainer.createEl("canvas", { cls: "stats-chart-canvas" });
		const summaryEl = this.futureDueEl.createDiv({ cls: "stats-chart-summary" });

		// Use filled version for proper day-by-day display
		const data = await this.statsCalculator.getFutureDueStatsFilled(this.currentRange);
		this.futureDueData = data; // Store for click handler

		if (data.length === 0) {
			this.futureDueEl.empty();
			this.futureDueEl.createEl("h3", { text: "Future due" });
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
			flashcardManager: this.plugin.flashcardManager,
		}).open();
	}

	private async renderCardsCreatedChart(): Promise<void> {
		this.cardsCreatedEl.empty();
		this.cardsCreatedEl.createEl("h3", { text: "Cards created" });

		// Skip for "backlog" range (it's for future predictions)
		if (this.currentRange === "backlog") {
			this.cardsCreatedEl.createDiv({
				cls: "stats-no-data",
				text: "Select a time range to see creation history",
			});
			return;
		}

		// Create elements synchronously before async calls
		const canvasContainer = this.cardsCreatedEl.createDiv({ cls: "stats-chart-container" });
		const canvas = canvasContainer.createEl("canvas", { cls: "stats-chart-canvas" });
		const summaryEl = this.cardsCreatedEl.createDiv({ cls: "stats-chart-summary" });

		const data = await this.statsCalculator.getCardsCreatedHistoryFilled(this.currentRange);
		this.cardsCreatedData = data; // Store for click handler

		if (data.length === 0) {
			this.cardsCreatedEl.empty();
			this.cardsCreatedEl.createEl("h3", { text: "Cards created" });
			this.cardsCreatedEl.createDiv({
				cls: "stats-no-data",
				text: "No data available",
			});
			return;
		}

		// Destroy existing chart if present
		if (this.charts.has("cardsCreated")) {
			this.charts.get("cardsCreated")!.destroy();
		}

		// Format labels
		const labels = data.map((d) => {
			const date = new Date(d.date);
			return `${date.getDate()}/${date.getMonth() + 1}`;
		});

		const maxTicks = this.getMaxTicksForRange();

		const chart = new Chart(canvas, {
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
							void this.openCardPreviewForCreatedDate(entry.date);
						}
					}
				},
			},
		});
		this.charts.set("cardsCreated", chart);

		// Summary
		const total = data.reduce((sum, d) => sum + d.count, 0);
		const daysWithCards = data.filter((d) => d.count > 0).length;
		const avg = daysWithCards > 0 ? Math.round(total / daysWithCards) : 0;
		summaryEl.createDiv({ text: `Total: ${total} cards` });
		summaryEl.createDiv({ text: `Average: ${avg} cards/day (on active days)` });
	}

	private async openCardPreviewForCreatedDate(date: string): Promise<void> {
		const cards = await this.statsCalculator.getCardsCreatedOnDate(date);
		new CardPreviewModal(this.plugin.app, {
			title: `Cards created: ${this.formatDateForDisplay(date)}`,
			cards,
			flashcardManager: this.plugin.flashcardManager,
		}).open();
	}

	private async renderCreatedVsReviewedChart(): Promise<void> {
		this.createdVsReviewedEl.empty();
		this.createdVsReviewedEl.createEl("h3", { text: "Created vs Reviewed" });

		// Skip for "backlog" range
		if (this.currentRange === "backlog") {
			this.createdVsReviewedEl.createDiv({
				cls: "stats-no-data",
				text: "Select a time range to see comparison",
			});
			return;
		}

		// Create elements synchronously before async calls
		const canvasContainer = this.createdVsReviewedEl.createDiv({ cls: "stats-chart-container" });
		const canvas = canvasContainer.createEl("canvas", { cls: "stats-chart-canvas" });
		const summaryEl = this.createdVsReviewedEl.createDiv({ cls: "stats-chart-summary" });

		const data = await this.statsCalculator.getCardsCreatedVsReviewedHistory(this.currentRange);
		this.createdVsReviewedData = data;

		if (data.length === 0) {
			this.createdVsReviewedEl.empty();
			this.createdVsReviewedEl.createEl("h3", { text: "Created vs Reviewed" });
			this.createdVsReviewedEl.createDiv({
				cls: "stats-no-data",
				text: "No data available",
			});
			return;
		}

		// Destroy existing chart if present
		if (this.charts.has("createdVsReviewed")) {
			this.charts.get("createdVsReviewed")!.destroy();
		}

		// Format labels
		const labels = data.map((d) => {
			const date = new Date(d.date);
			return `${date.getDate()}/${date.getMonth() + 1}`;
		});

		const maxTicks = this.getMaxTicksForRange();

		const chart = new Chart(canvas, {
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
			},
		});
		this.charts.set("createdVsReviewed", chart);

		// Summary
		const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
		const totalReviewed = data.reduce((sum, d) => sum + d.reviewed, 0);
		const totalSameDay = data.reduce((sum, d) => sum + d.createdAndReviewedSameDay, 0);
		const sameDayRate = totalCreated > 0 ? Math.round((totalSameDay / totalCreated) * 100) : 0;

		summaryEl.createDiv({ text: `Created: ${totalCreated} | Reviewed: ${totalReviewed}` });
		summaryEl.createDiv({ text: `Same-day review rate: ${sameDayRate}%` });
	}

	private async renderRetentionChart(): Promise<void> {
		this.retentionEl.empty();
		this.retentionEl.createEl("h3", { text: "Retention rate" });

		// Create elements synchronously before async calls
		const canvasContainer = this.retentionEl.createDiv({ cls: "stats-chart-container" });
		const canvas = canvasContainer.createEl("canvas", { cls: "stats-chart-canvas" });
		const summaryEl = this.retentionEl.createDiv({ cls: "stats-chart-summary" });

		const data = await this.statsCalculator.getRetentionHistory(this.currentRange);

		if (data.length === 0) {
			this.retentionEl.empty();
			this.retentionEl.createEl("h3", { text: "Retention rate" });
			this.retentionEl.createDiv({
				cls: "stats-no-data",
				text: "No review history available",
			});
			return;
		}

		// Destroy existing chart if present
		if (this.charts.has("retention")) {
			this.charts.get("retention")!.destroy();
		}

		// Format labels to show day/month
		const labels = data.map((d) => {
			const date = new Date(d.date);
			return `${date.getDate()}/${date.getMonth() + 1}`;
		});

		const maxTicks = this.getMaxTicksForRange();

		const chart = new Chart(canvas, {
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
		this.charts.set("retention", chart);

		// Summary: average retention
		const avgRetention = data.length > 0
			? Math.round(data.reduce((sum, d) => sum + d.retention, 0) / data.length)
			: 0;
		const totalReviews = data.reduce((sum, d) => sum + d.total, 0);
		summaryEl.createDiv({ text: `Average: ${avgRetention}%` });
		summaryEl.createDiv({ text: `Total reviews: ${totalReviews}` });
	}

	private async renderCardCountsChart(): Promise<void> {
		this.cardCountsEl.empty();
		this.cardCountsEl.createEl("h3", { text: "Card counts" });

		const breakdown = await this.statsCalculator.getCardMaturityBreakdown();
		const activeTotal = breakdown.new + breakdown.learning + breakdown.young + breakdown.mature;
		const total = activeTotal + breakdown.suspended + breakdown.buried;

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

		// Add buried to chart if any
		if (breakdown.buried > 0) {
			chartData.push(breakdown.buried);
			chartLabels.push("Buried");
			chartColors.push("rgba(156, 163, 175, 0.8)"); // Buried - lighter gray
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

		// Add buried to legend if any
		if (breakdown.buried > 0) {
			items.push({ label: "Buried", value: breakdown.buried, color: "#9ca3af", category: "buried" });
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
			flashcardManager: this.plugin.flashcardManager,
			category,
		}).open();
	}

	private async renderCalendarHeatmap(): Promise<void> {
		this.calendarEl.empty();
		this.calendarEl.createEl("h3", { text: "Activity calendar" });

		const allStats = await this.statsCalculator.getAllDailyStats();

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
