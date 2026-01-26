/**
 * ChartSection Component
 * Base class for all chart sections, handling common chart logic
 * Features: canvas container, loading state, empty state, summary section, chart cleanup
 */
import { Chart } from "chart.js";
import { BaseComponent } from "../../component.base";
import { StatsCard } from "./StatsCard";

export interface ChartSectionProps {
	/** Chart title displayed in card header */
	title?: string;
	/** Canvas height in pixels (default: 208 for h-52) */
	height?: number;
	/** Optional action button in header */
	action?: {
		label: string;
		onClick: () => void;
	};
}

/**
 * Base class for chart sections
 * Extends BaseComponent and wraps content in StatsCard
 * Handles chart lifecycle and common UI patterns
 */
export abstract class ChartSection<TData = unknown> extends BaseComponent {
	protected chart: Chart | null = null;
	protected data: TData[] = [];
	protected statsCard: StatsCard;
	protected canvas!: HTMLCanvasElement;
	protected summaryContainer: HTMLElement | null = null;

	constructor(container: HTMLElement, cardProps: ChartSectionProps = {}) {
		super(container);
		this.statsCard = new StatsCard(container, {
			title: cardProps.title,
			action: cardProps.action,
			hoverLift: true,
		});
	}

	/**
	 * Render the chart section
	 * Creates card, canvas container, and initializes chart
	 */
	render(): void {
		// Clean up existing chart if any
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}

		// Render the card
		this.statsCard.render();

		// Get content container from card
		const contentContainer = this.statsCard.getContentContainer();

		// Create canvas container with fixed height
		const canvasContainer = contentContainer.createDiv({
			cls: [
				"ep:w-full",
				this.getCanvasHeightClass(),
				"ep:ep:relative",
			].join(" "),
		});

		// Create canvas element
		this.canvas = canvasContainer.createEl("canvas", {
			cls: "episteme-chart-fade-in",
		});
	}

	/**
	 * Get the canvas height class based on props
	 */
	private getCanvasHeightClass(): string {
		// Default to h-52 (208px)
		return "ep:h-52";
	}

	/**
	 * Refresh the chart data and re-render
	 */
	async refresh(): Promise<void> {
		try {
			this.data = await this.fetchData();

			if (this.data.length === 0) {
				this.renderEmptyState();
				return;
			}

			this.renderChart(this.data);
		} catch (error) {
			console.error(`Error refreshing chart:`, error);
			this.renderErrorState(error instanceof Error ? error.message : "Unknown error");
		}
	}

	/**
	 * Fetch data for the chart
	 * Must be implemented by subclasses
	 */
	abstract fetchData(): Promise<TData[]>;

	/**
	 * Render the chart with fetched data
	 * Must be implemented by subclasses
	 */
	abstract renderChart(data: TData[]): void;

	/**
	 * Get the chart title
	 * Override in subclasses if dynamic title is needed
	 */
	getChartTitle(): string {
		return "Chart";
	}

	/**
	 * Render empty state when no data is available
	 */
	protected renderEmptyState(message: string = "No data available"): void {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}

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
			].join(" "),
			text: message,
		});
	}

	/**
	 * Render error state when data fetch fails
	 */
	protected renderErrorState(message: string): void {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}

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
			text: `Error: ${message}`,
		});
	}

	/**
	 * Create summary section below the chart
	 */
	protected createSummary(summary: string[]): void {
		const contentContainer = this.statsCard.getContentContainer();

		// Remove existing summary if any
		if (this.summaryContainer) {
			this.summaryContainer.remove();
		}

		// Create summary container
		this.summaryContainer = contentContainer.createDiv({
			cls: [
				"ep:mt-4", // Top margin
				"ep:pt-4", // Top padding
				"ep:border-t", // Top border
				"ep:border-obs-border", // Plain border for internal divider
				"ep:flex",
				"ep:flex-col",
				"ep:gap-1.5",
			].join(" "),
		});

		// Add summary items
		for (const item of summary) {
			const summaryItem = this.summaryContainer.createDiv({
				cls: [
					"ep:text-ui-small",
					"ep:text-obs-muted",
					"ep:flex",
					"ep:items-center",
					"ep:gap-2",
				].join(" "),
			});

			// Bullet point
			summaryItem.createDiv({
				cls: [
					"ep:w-1.5",
					"ep:h-1.5",
					"ep:rounded-full",
					"ep:bg-obs-interactive",
					"ep:shrink-0",
				].join(" "),
			});

			// Text
			summaryItem.createSpan({ text: item });
		}
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
