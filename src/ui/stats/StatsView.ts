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
import { StatsCalculatorService } from "../../services";
import { CardPreviewModal } from "../modals";
import { NLQueryPanel } from "./NLQueryPanel";
import type TrueRecallPlugin from "../../main";
import type {
	StatsTimeRange,
	CardMaturityBreakdown,
	FSRSFlashcardItem,
} from "../../types";
import { effect } from "@preact/signals-core";
import { dataVersion, settingsVersion, syncVersion, track } from "../../services/core/signals";
import {
	TodaySection,
	TimeRangeSelector,
	FutureDueChart,
	ReviewsChart,
	RetentionChart,
	CardCountsChart,
	CalendarHeatmap,
} from "./components";

export class StatsView extends ItemView {
	private static chartRegistered = false;

	private static registerChartJs(): void {
		if (StatsView.chartRegistered) return;
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
		StatsView.chartRegistered = true;
	}

	private plugin: TrueRecallPlugin;
	private statsCalculator: StatsCalculatorService;
	private currentRange: StatsTimeRange = "1m";

	private signalDisposer: (() => void) | null = null;
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	// Child components
	private todaySection: TodaySection | null = null;
	private timeRangeSelector: TimeRangeSelector | null = null;
	private futureDueChart: FutureDueChart | null = null;
	private reviewsChart: ReviewsChart | null = null;
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
		StatsView.registerChartJs();

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

		this.subscribeToDataChanges();

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

		this.signalDisposer?.();

		// Destroy all components
		this.todaySection?.destroy();
		this.timeRangeSelector?.destroy();
		this.futureDueChart?.destroy();
		this.reviewsChart?.destroy();
		this.retentionChart?.destroy();
		this.cardCountsChart?.destroy();
		this.calendarHeatmap?.destroy();
		// Note: NLQueryPanel doesn't have a destroy method, managed by component lifecycle
	}

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

		this.reviewsChart = new ReviewsChart(this.contentWrapper, {
			statsCalculator: this.statsCalculator,
			currentRange: this.currentRange,
			onCardPreview: (date, cards) => this.openCardPreviewForDate(date, cards),
		});
		this.reviewsChart.render();

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

	private subscribeToDataChanges(): void {
		this.signalDisposer = effect(() => {
			track(dataVersion, settingsVersion, syncVersion);
			this.scheduleRefresh();
		});
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = setTimeout(() => {
			void this.refresh();
			this.refreshTimer = null;
		}, 500);
	}

	private async setRange(range: StatsTimeRange): Promise<void> {
		this.currentRange = range;

		// Update time range selector
		this.timeRangeSelector?.updateRange(range);

		// Update today section
		this.todaySection?.updateRange(range);

		// Update chart components
		await Promise.all([
			this.futureDueChart?.updateRange(range),
			this.reviewsChart?.updateRange(range),
			this.retentionChart?.updateRange(range),
		]);
	}

	async refresh(): Promise<void> {
		await Promise.all([
			this.todaySection?.refresh(),
			this.futureDueChart?.refresh(),
			this.reviewsChart?.refresh(),
			this.retentionChart?.refresh(),
			this.cardCountsChart?.refresh(),
			this.calendarHeatmap?.refresh(),
		]);
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

	private openCardPreviewForDate(date: string, cards: FSRSFlashcardItem[]): void {
		new CardPreviewModal(this.plugin.app, {
			title: `Cards reviewed: ${this.formatDateForDisplay(date)}`,
			cards,
			flashcardManager: this.plugin.flashcardManager,
		}).open();
	}

	private openCardPreviewForCategory(
		category: keyof CardMaturityBreakdown,
		label: string,
		cards: FSRSFlashcardItem[]
	): void {
		new CardPreviewModal(this.plugin.app, {
			title: `${label} cards (${cards.length})`,
			cards,
			flashcardManager: this.plugin.flashcardManager,
			category,
		}).open();
	}
}
