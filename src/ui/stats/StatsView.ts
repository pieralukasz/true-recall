/**
 * Statistics View
 * Displays comprehensive statistics with elegant card-based layout
 *
 * Refactored to use modular components for better maintainability
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
import type TrueRecallPlugin from "../../main";
import type {
	StatsTimeRange,
	CardMaturityBreakdown,
} from "../../types";
import type {
	CardReviewedEvent,
	CardAddedEvent,
	CardRemovedEvent,
	CardUpdatedEvent,
	BulkChangeEvent,
	StoreSyncedEvent,
} from "../../types/events.types";
import {
	TodaySection,
	TimeRangeSelector,
	FutureDueChart,
	CardsCreatedChart,
	CreatedVsReviewedChart,
	RetentionChart,
	CardCountsChart,
	CalendarHeatmap,
} from "./components";

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
	private plugin: TrueRecallPlugin;
	private statsCalculator: StatsCalculatorService;
	private currentRange: StatsTimeRange = "1m";

	// Event subscriptions for cross-component reactivity
	private eventUnsubscribers: (() => void)[] = [];
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	// Child components
	private todaySection: TodaySection | null = null;
	private timeRangeSelector: TimeRangeSelector | null = null;
	private futureDueChart: FutureDueChart | null = null;
	private cardsCreatedChart: CardsCreatedChart | null = null;
	private createdVsReviewedChart: CreatedVsReviewedChart | null = null;
	private retentionChart: RetentionChart | null = null;
	private cardCountsChart: CardCountsChart | null = null;
	private calendarHeatmap: CalendarHeatmap | null = null;

	// NL Query Panel
	private nlQueryPanel: NLQueryPanel | null = null;

	// Container elements for components
	private contentWrapper!: HTMLElement;
	private nlQueryEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
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
		container.addClasses(["ep:overflow-y-auto", "ep:h-full"]);

		// Inner wrapper for centered content with padding
		this.contentWrapper = container.createDiv({
			cls: "ep:p-2 ep:max-w-[900px] ep:mx-auto",
		});

		// Set SQLite store BEFORE createLayout - charts call refresh() during render
		this.statsCalculator.setSqliteStore(this.plugin.cardStore);

		// Subscribe to EventBus for cross-component reactivity
		this.subscribeToEvents();

		// Create layout and initialize components (charts will have SQLite store)
		this.createLayout();

		// Initial render (redundant since charts refresh in render(), but keeps consistent)
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

		// Destroy all components
		this.todaySection?.destroy();
		this.timeRangeSelector?.destroy();
		this.futureDueChart?.destroy();
		this.cardsCreatedChart?.destroy();
		this.createdVsReviewedChart?.destroy();
		this.retentionChart?.destroy();
		this.cardCountsChart?.destroy();
		this.calendarHeatmap?.destroy();
		// Note: NLQueryPanel doesn't have a destroy method, managed by component lifecycle
	}

	/**
	 * Create the layout and initialize all components
	 */
	private createLayout(): void {
		// 1. NL Query Section (Learning Insights) - uses StatsCard internally
		this.nlQueryEl = this.contentWrapper.createDiv();
		this.nlQueryPanel = new NLQueryPanel(this.nlQueryEl, this.app, this);
		this.nlQueryPanel.render();

		// Set NL Query Service if available
		if (this.plugin.nlQueryService) {
			this.nlQueryPanel.setService(this.plugin.nlQueryService);
		}

		// 2. Today Section
		this.todaySection = new TodaySection(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			currentRange: this.currentRange,
		});
		this.todaySection.render();

		// 3. Time Range Selector
		this.timeRangeSelector = new TimeRangeSelector(this.contentWrapper, {
			currentRange: this.currentRange,
			onRangeChange: (range) => void this.setRange(range),
		});
		this.timeRangeSelector.render();

		// 4. Chart Components
		this.futureDueChart = new FutureDueChart(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			currentRange: this.currentRange,
			onCardPreview: (date, cards) => this.openCardPreviewForDate(date, cards),
		});
		this.futureDueChart.render();

		this.cardsCreatedChart = new CardsCreatedChart(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			currentRange: this.currentRange,
			onCardPreview: (date, cards) => this.openCardPreviewForCreatedDate(date, cards),
		});
		this.cardsCreatedChart.render();

		this.createdVsReviewedChart = new CreatedVsReviewedChart(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			currentRange: this.currentRange,
			onCardPreview: (date, cards) => this.openCardPreviewForDate(date, cards),
		});
		this.createdVsReviewedChart.render();

		this.retentionChart = new RetentionChart(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			currentRange: this.currentRange,
		});
		this.retentionChart.render();

		this.cardCountsChart = new CardCountsChart(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			onCardPreview: (category, label, cards) => this.openCardPreviewForCategory(category, label, cards),
		});
		this.cardCountsChart.render();

		this.calendarHeatmap = new CalendarHeatmap(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			onCardPreview: (date, cards) => this.openCardPreviewForDate(date, cards),
		});
		this.calendarHeatmap.render();
	}

	/**
	 * Subscribe to EventBus events for cross-component reactivity
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

	/**
	 * Set the time range and refresh all affected components
	 */
	private async setRange(range: StatsTimeRange): Promise<void> {
		this.currentRange = range;

		// Update time range selector
		this.timeRangeSelector?.updateRange(range);

		// Update today section
		this.todaySection?.updateRange(range);

		// Update chart components
		await Promise.all([
			this.futureDueChart?.updateRange(range),
			this.cardsCreatedChart?.updateRange(range),
			this.createdVsReviewedChart?.updateRange(range),
			this.retentionChart?.updateRange(range),
		]);
	}

	/**
	 * Refresh all components
	 */
	async refresh(): Promise<void> {
		await Promise.all([
			this.todaySection?.refresh(),
			this.futureDueChart?.refresh(),
			this.cardsCreatedChart?.refresh(),
			this.createdVsReviewedChart?.refresh(),
			this.retentionChart?.refresh(),
			this.cardCountsChart?.refresh(),
			this.calendarHeatmap?.refresh(),
		]);
	}

	// ===== Card Preview Handlers =====

	private formatDateForDisplay(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString(undefined, {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	private openCardPreviewForDate(date: string, cards: any[]): void {
		new CardPreviewModal(this.plugin.app, {
			title: `Cards due: ${this.formatDateForDisplay(date)}`,
			cards,
			flashcardManager: this.plugin.flashcardManager,
		}).open();
	}

	private openCardPreviewForCreatedDate(date: string, cards: any[]): void {
		new CardPreviewModal(this.plugin.app, {
			title: `Cards created: ${this.formatDateForDisplay(date)}`,
			cards,
			flashcardManager: this.plugin.flashcardManager,
		}).open();
	}

	private openCardPreviewForCategory(
		category: keyof CardMaturityBreakdown,
		label: string,
		cards: any[]
	): void {
		new CardPreviewModal(this.plugin.app, {
			title: `${label} Cards (${cards.length})`,
			cards,
			flashcardManager: this.plugin.flashcardManager,
			category,
		}).open();
	}
}
