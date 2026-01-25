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
		container.addClass("ep:p-4 ep:overflow-y-auto ep:h-full ep:max-w-[900px] ep:mx-auto");

		// Create section containers
		this.createSections(container);

		// Subscribe to EventBus for cross-component reactivity
		this.subscribeToEvents();

		// Set SQLite store for optimized queries (like Created vs Reviewed chart)
		this.statsCalculator.setSqliteStore(this.plugin.cardStore);

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
		// Shared section styling
		const sectionCls = "ep:mb-6 ep:p-4 ep:bg-obs-secondary ep:rounded-lg";

		// 1. Today Summary Section
		this.todayEl = container.createDiv({ cls: sectionCls });

		// 2. NL Query Section (AI-powered) - Learning Insights
		this.nlQueryEl = container.createDiv({
			cls: `${sectionCls} ep:border-b ep:border-obs-border ep:pb-4`,
		});
		this.nlQueryPanel = new NLQueryPanel(this.nlQueryEl, this.app, this);
		this.nlQueryPanel.render();

		// Set NL Query Service if available
		if (this.plugin.nlQueryService) {
			this.nlQueryPanel.setService(this.plugin.nlQueryService);
		}

		// 3. Time Range Selector
		this.rangeSelectorEl = container.createDiv({
			cls: "ep:flex ep:gap-2 ep:mb-4 ep:flex-wrap",
		});
		this.createRangeButtons();

		// 4. Future Due Section (bar chart)
		this.futureDueEl = container.createDiv({ cls: sectionCls });

		// 5. Cards Created Section (bar chart - historical)
		this.cardsCreatedEl = container.createDiv({ cls: sectionCls });

		// 6. Created vs Reviewed Section (grouped bar chart)
		this.createdVsReviewedEl = container.createDiv({ cls: sectionCls });

		// 7. Retention Rate Section (line chart)
		this.retentionEl = container.createDiv({ cls: sectionCls });

		// 8. Card Counts Section (pie chart)
		this.cardCountsEl = container.createDiv({ cls: sectionCls });

		// 9. Calendar Heatmap Section
		this.calendarEl = container.createDiv({ cls: sectionCls });
	}

	private createRangeButtons(): void {
		const ranges: { label: string; value: StatsTimeRange }[] = [
			{ label: "Backlog", value: "backlog" },
			{ label: "1 Month", value: "1m" },
			{ label: "3 Months", value: "3m" },
			{ label: "1 Year", value: "1y" },
			{ label: "All", value: "all" },
		];

		const baseBtnCls = "ep:py-1.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-secondary ep:text-obs-muted ep:cursor-pointer ep:text-sm ep:transition-all ep:hover:bg-obs-modifier-hover";
		const activeBtnCls = "ep:bg-obs-interactive ep:text-white ep:border-obs-interactive";

		for (const range of ranges) {
			const isActive = this.currentRange === range.value;
			const btn = this.rangeSelectorEl.createEl("button", {
				text: range.label,
				cls: `stats-range-btn ${baseBtnCls} ${isActive ? activeBtnCls : ""}`,
				attr: { "data-range": range.value },
			});
			btn.addEventListener("click", () => void this.setRange(range.value));
		}
	}

	private async setRange(range: StatsTimeRange): Promise<void> {
		this.currentRange = range;

		// Update button states using data attributes
		const buttons = this.rangeSelectorEl.querySelectorAll(".stats-range-btn");
		const activeCls = ["ep:bg-obs-interactive", "ep:text-white", "ep:border-obs-interactive"];
		buttons.forEach((btn) => {
			const btnRange = btn.getAttribute("data-range");
			const isActive = btnRange === range;
			activeCls.forEach((cls) => btn.classList.toggle(cls, isActive));
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
		const h3 = this.todayEl.createEl("h3", { text: "Today" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		const summary = await this.statsCalculator.getTodaySummary();
		const streak = await this.statsCalculator.getStreakInfo();
		const rangeSummary = await this.statsCalculator.getRangeSummary(this.currentRange);

		if (summary.studied === 0) {
			this.todayEl.createDiv({
				cls: "ep:text-obs-muted ep:italic ep:mb-4",
				text: "No cards have been studied today.",
			});
		}

		const grid = this.todayEl.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-3 ep:mb-4",
		});

		this.createStatCard(grid, "Studied", summary.studied.toString());
		this.createStatCard(grid, "Minutes", summary.minutes.toString());
		this.createStatCard(grid, "New", summary.newCards.toString());
		this.createStatCard(grid, "Again", summary.again.toString());
		this.createStatCard(grid, "Correct", `${Math.round(summary.correctRate * 100)}%`);
		this.createStatCard(grid, "Streak", `${streak.current}d`);

		// Additional summary
		const summaryEl = this.todayEl.createDiv({ cls: "ep:text-sm ep:text-obs-muted" });
		summaryEl.createDiv({
			text: `Due tomorrow: ${rangeSummary.dueTomorrow} reviews`,
			cls: "ep:mb-1",
		});
		summaryEl.createDiv({
			text: `Daily load: ~${rangeSummary.dailyLoad} reviews/day`,
			cls: "ep:mb-1",
		});
	}

	private createStatCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createDiv({
			cls: "ep:text-center ep:p-3 ep:bg-obs-primary ep:rounded-md",
		});
		card.createDiv({
			cls: "ep:text-2xl ep:font-bold ep:text-obs-normal",
			text: value,
		});
		card.createDiv({
			cls: "ep:text-xs ep:text-obs-muted ep:mt-1",
			text: label,
		});
	}

	private async renderFutureDueChart(): Promise<void> {
		this.futureDueEl.empty();
		const h3 = this.futureDueEl.createEl("h3", { text: "Future due" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		// Create all elements synchronously BEFORE async calls to prevent race conditions
		const canvasContainer = this.futureDueEl.createDiv({
			cls: "ep:w-full ep:h-50 ep:relative",
		});
		const canvas = canvasContainer.createEl("canvas", {
			cls: "ep:w-full! ep:h-full!",
		});
		const summaryEl = this.futureDueEl.createDiv({
			cls: "ep:mt-3 ep:text-sm ep:text-obs-muted",
		});

		// Use filled version for proper day-by-day display
		const data = await this.statsCalculator.getFutureDueStatsFilled(this.currentRange);
		this.futureDueData = data; // Store for click handler

		if (data.length === 0) {
			this.futureDueEl.empty();
			const h3Empty = this.futureDueEl.createEl("h3", { text: "Future due" });
			h3Empty.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");
			this.futureDueEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
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
		summaryEl.createDiv({ text: `Total: ${total} reviews`, cls: "ep:mb-1" });
		summaryEl.createDiv({ text: `Average: ${avg} reviews/day`, cls: "ep:mb-1" });
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
		const h3 = this.cardsCreatedEl.createEl("h3", { text: "Cards created" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		// Skip for "backlog" range (it's for future predictions)
		if (this.currentRange === "backlog") {
			this.cardsCreatedEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
				text: "Select a time range to see creation history",
			});
			return;
		}

		// Create elements synchronously before async calls
		const canvasContainer = this.cardsCreatedEl.createDiv({
			cls: "ep:w-full ep:h-50 ep:relative",
		});
		const canvas = canvasContainer.createEl("canvas", {
			cls: "ep:w-full! ep:h-full!",
		});
		const summaryEl = this.cardsCreatedEl.createDiv({
			cls: "ep:mt-3 ep:text-sm ep:text-obs-muted",
		});

		const data = await this.statsCalculator.getCardsCreatedHistoryFilled(this.currentRange);
		this.cardsCreatedData = data; // Store for click handler

		if (data.length === 0) {
			this.cardsCreatedEl.empty();
			const h3Empty = this.cardsCreatedEl.createEl("h3", { text: "Cards created" });
			h3Empty.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");
			this.cardsCreatedEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
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
		summaryEl.createDiv({ text: `Total: ${total} cards`, cls: "ep:mb-1" });
		summaryEl.createDiv({ text: `Average: ${avg} cards/day (on active days)`, cls: "ep:mb-1" });
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
		const h3 = this.createdVsReviewedEl.createEl("h3", { text: "Created vs Reviewed" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		// Skip for "backlog" range
		if (this.currentRange === "backlog") {
			this.createdVsReviewedEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
				text: "Select a time range to see comparison",
			});
			return;
		}

		// Create elements synchronously before async calls
		const canvasContainer = this.createdVsReviewedEl.createDiv({
			cls: "ep:w-full ep:h-50 ep:relative",
		});
		const canvas = canvasContainer.createEl("canvas", {
			cls: "ep:w-full! ep:h-full!",
		});
		const summaryEl = this.createdVsReviewedEl.createDiv({
			cls: "ep:mt-3 ep:text-sm ep:text-obs-muted",
		});

		const data = await this.statsCalculator.getCardsCreatedVsReviewedHistory(this.currentRange);
		this.createdVsReviewedData = data;

		if (data.length === 0) {
			this.createdVsReviewedEl.empty();
			const h3Empty = this.createdVsReviewedEl.createEl("h3", { text: "Created vs Reviewed" });
			h3Empty.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");
			this.createdVsReviewedEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
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

		summaryEl.createDiv({ text: `Created: ${totalCreated} | Reviewed: ${totalReviewed}`, cls: "ep:mb-1" });
		summaryEl.createDiv({ text: `Same-day review rate: ${sameDayRate}%`, cls: "ep:mb-1" });
	}

	private async renderRetentionChart(): Promise<void> {
		this.retentionEl.empty();
		const h3 = this.retentionEl.createEl("h3", { text: "Retention rate" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		// Create elements synchronously before async calls
		const canvasContainer = this.retentionEl.createDiv({
			cls: "ep:w-full ep:h-50 ep:relative",
		});
		const canvas = canvasContainer.createEl("canvas", {
			cls: "ep:w-full! ep:h-full!",
		});
		const summaryEl = this.retentionEl.createDiv({
			cls: "ep:mt-3 ep:text-sm ep:text-obs-muted",
		});

		const data = await this.statsCalculator.getRetentionHistory(this.currentRange);

		if (data.length === 0) {
			this.retentionEl.empty();
			const h3Empty = this.retentionEl.createEl("h3", { text: "Retention rate" });
			h3Empty.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");
			this.retentionEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
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
		summaryEl.createDiv({ text: `Average: ${avgRetention}%`, cls: "ep:mb-1" });
		summaryEl.createDiv({ text: `Total reviews: ${totalReviews}`, cls: "ep:mb-1" });
	}

	private async renderCardCountsChart(): Promise<void> {
		this.cardCountsEl.empty();
		const h3 = this.cardCountsEl.createEl("h3", { text: "Card counts" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		const breakdown = await this.statsCalculator.getCardMaturityBreakdown();
		const activeTotal = breakdown.new + breakdown.learning + breakdown.young + breakdown.mature;
		const total = activeTotal + breakdown.suspended + breakdown.buried;

		if (total === 0) {
			this.cardCountsEl.createDiv({
				cls: "ep:text-obs-muted ep:text-center ep:py-10 ep:px-5 ep:italic",
				text: "No cards found",
			});
			return;
		}

		const chartRow = this.cardCountsEl.createDiv({
			cls: "ep:flex ep:gap-8 ep:items-center ep:justify-center",
		});

		// Chart (only active cards, suspended shown separately)
		const canvasContainer = chartRow.createDiv({
			cls: "ep:w-45 ep:h-45 ep:relative ep:shrink-0",
		});
		const canvas = canvasContainer.createEl("canvas", {
			cls: "ep:w-full! ep:h-full!",
		});

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
		const legendEl = chartRow.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2",
		});
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
			const row = legendEl.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2 ep:text-sm ep:cursor-pointer ep:py-1.5 ep:px-2 ep:-my-1.5 ep:-mx-2 ep:rounded-md ep:transition-colors ep:hover:bg-obs-modifier-hover",
			});
			const colorSpan = row.createSpan({
				cls: "ep:w-3 ep:h-3 ep:rounded-sm ep:shrink-0",
			});
			colorSpan.style.backgroundColor = item.color;
			row.createSpan({ text: `${item.label}` });
			row.createSpan({
				cls: "ep:ml-auto ep:text-obs-muted",
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
		const h3 = this.calendarEl.createEl("h3", { text: "Activity calendar" });
		h3.addClass("ep:m-0 ep:mb-4 ep:text-base ep:font-semibold ep:text-obs-normal");

		const allStats = await this.statsCalculator.getAllDailyStats();

		// Header with year navigation
		const today = new Date();
		const yearLabel = this.calendarEl.createDiv({
			cls: "ep:text-center ep:text-sm ep:font-semibold ep:mb-3 ep:text-obs-normal",
		});
		yearLabel.createEl("span", { text: today.getFullYear().toString() });

		// Create calendar grid (last 365 days, 53 weeks x 7 days)
		const calendarGrid = this.calendarEl.createDiv({
			cls: "ep:flex ep:gap-0.5 ep:flex-nowrap ep:overflow-x-auto ep:pb-2",
		});

		// Day labels (Mon, Wed, Fri) - hidden by default
		const dayLabels = this.calendarEl.createDiv({ cls: "ep:hidden" });
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
			const weekColumn = calendarGrid.createDiv({
				cls: "ep:flex ep:flex-col ep:gap-0.5",
			});

			for (let day = 0; day < 7; day++) {
				const cellDate = new Date(startDate);
				cellDate.setDate(cellDate.getDate() + week * 7 + day);

				const dateKey = cellDate.toISOString().split("T")[0]!;
				const stats = allStats[dateKey];
				const count = stats?.reviewsCompleted ?? 0;

				const cell = weekColumn.createDiv({
					cls: `stats-calendar-cell ep:w-2.5 ep:h-2.5 ep:rounded-sm ep:cursor-pointer ${this.getHeatmapLevel(count)}`,
				});

				// Only show cells for dates up to today
				if (cellDate > today) {
					cell.addClass("ep:opacity-30");
				}

				// Tooltip
				cell.setAttribute("aria-label", `${dateKey}: ${count} reviews`);
				cell.setAttribute("title", `${dateKey}: ${count} reviews`);
			}
		}

		// Legend
		const legend = this.calendarEl.createDiv({
			cls: "ep:flex ep:items-center ep:justify-end ep:gap-1 ep:mt-2 ep:text-xs ep:text-obs-muted",
		});
		legend.createSpan({ text: "Less" });
		for (let i = 0; i <= 4; i++) {
			legend.createDiv({
				cls: `stats-calendar-cell ep:w-2.5 ep:h-2.5 ep:rounded-sm ep:cursor-default level-${i}`,
			});
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
