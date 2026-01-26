/**
 * CalendarHeatmap Component
 * GitHub-style activity calendar showing review history
 * Shows last 365 days as a 53x7 grid with color intensity levels
 */
import { BaseComponent } from "../../component.base";
import { StatsCard } from "./StatsCard";
import type { StatsCalculatorService } from "../../../services";

export interface CalendarHeatmapProps {
	statsCalculator: StatsCalculatorService;
	onCardPreview?: (date: string, cards: any[]) => void;
}

/**
 * Daily stats data structure
 */
interface DailyStats {
	reviewsCompleted: number;
}

/**
 * CalendarHeatmap - Shows activity calendar with GitHub-style heatmap
 */
export class CalendarHeatmap extends BaseComponent {
	private props: CalendarHeatmapProps;
	private statsCard: StatsCard;

	constructor(container: HTMLElement, props: CalendarHeatmapProps) {
		super(container);
		this.props = props;
		this.statsCard = new StatsCard(container, {
			title: "Activity calendar",
			hoverLift: true,
		});
	}

	render(): void {
		// Render the card
		this.statsCard.render();
	}

	/**
	 * Refresh the calendar heatmap
	 */
	async refresh(): Promise<void> {
		try {
			const allStats = await this.props.statsCalculator.getAllDailyStats();
			await this.renderCalendar(allStats);
		} catch (error) {
			console.error("Error refreshing calendar heatmap:", error);
			this.renderErrorState();
		}
	}

	/**
	 * Render the calendar heatmap
	 */
	private async renderCalendar(allStats: Record<string, DailyStats>): Promise<void> {
		const contentContainer = this.statsCard.getContentContainer();
		contentContainer.empty();

		// Header with current year
		const today = new Date();
		const yearHeader = contentContainer.createDiv({
			cls: [
				"ep:text-center",
				"ep:text-ui-small",
				"ep:font-semibold",
				"ep:mb-3",
				"ep:text-obs-normal",
			].join(" "),
		});
		yearHeader.createEl("span", { text: today.getFullYear().toString() });

		// Create calendar grid (53 weeks x 7 days)
		const calendarGrid = contentContainer.createDiv({
			cls: [
				"ep:flex",
				"ep:gap-0.5",
				"ep:flex-nowrap",
				"ep:overflow-x-auto",
				"ep:pb-2",
				"episteme-scrollbar-thin",
			].join(" "),
		});

		// Calculate starting point (53 weeks ago, aligned to Sunday)
		const startDate = new Date(today);
		startDate.setDate(startDate.getDate() - 364);
		// Align to Sunday
		const dayOfWeek = startDate.getDay();
		startDate.setDate(startDate.getDate() - dayOfWeek);

		// Create grid by weeks (columns) then days (rows)
		for (let week = 0; week < 53; week++) {
			const weekColumn = calendarGrid.createDiv({
				cls: [
					"ep:flex",
					"ep:flex-col",
					"ep:gap-0.5",
				].join(" "),
			});

			for (let day = 0; day < 7; day++) {
				const cellDate = new Date(startDate);
				cellDate.setDate(cellDate.getDate() + week * 7 + day);

				const dateKey = cellDate.toISOString().split("T")[0]!;
				const stats = allStats[dateKey];
				const count = stats?.reviewsCompleted ?? 0;

				const cell = weekColumn.createDiv({
					cls: [
						"ep:w-3",
						"ep:h-3",
						"ep:rounded-sm",
						"ep:cursor-pointer",
						"ep:transition-all",
						"ep:duration-150",
						// Hover effect
						"ep:hover:scale-110",
						"ep:hover:shadow-sm",
						"ep:hover:opacity-80",
						...this.getHeatmapLevelClasses(count),
					].join(" "),
				});

				// Only show cells for dates up to today
				if (cellDate > today) {
					cell.addClass("ep:opacity-30");
				}

				// Tooltip
				cell.setAttribute("aria-label", `${dateKey}: ${count} reviews`);
				cell.setAttribute("title", `${dateKey}: ${count} reviews`);

				// Click handler for dates with activity
				if (count > 0 && this.props.onCardPreview) {
					this.events.addEventListener(cell, "click", () => {
						void this.handleDateClick(dateKey);
					});
				}
			}
		}

		// Legend
		this.renderLegend(contentContainer);
	}

	/**
	 * Render the legend showing activity levels
	 */
	private renderLegend(container: HTMLElement): void {
		const legend = container.createDiv({
			cls: [
				"ep:flex",
				"ep:items-center",
				"ep:justify-end",
				"ep:gap-1",
				"ep:mt-3",
				"ep:text-ui-smaller",
				"ep:text-obs-muted",
			].join(" "),
		});

		legend.createSpan({ text: "Less" });

		for (let i = 0; i <= 4; i++) {
			legend.createDiv({
				cls: [
					"ep:w-3",
					"ep:h-3",
					"ep:rounded-sm",
					"ep:cursor-default",
					...this.getHeatmapLevelClasses(i),
				].join(" "),
			});
		}

		legend.createSpan({ text: "More" });
	}

	/**
	 * Get the heatmap level classes based on review count
	 */
	private getHeatmapLevelClasses(count: number): string[] {
		if (count === 0) return ["ep:!bg-obs-modifier-border"];
		if (count < 10) return ["ep:!bg-[rgba(var(--obs-green-rgb),0.2)]"];
		if (count < 25) return ["ep:!bg-[rgba(var(--obs-green-rgb),0.4)]"];
		if (count < 50) return ["ep:!bg-[rgba(var(--obs-green-rgb),0.6)]"];
		return ["ep:!bg-[rgba(var(--obs-green-rgb),0.9)]"];
	}

	/**
	 * Handle click on a calendar cell
	 */
	private async handleDateClick(date: string): Promise<void> {
		const cards = await this.props.statsCalculator.getCardsDueOnDate(date);

		if (this.props.onCardPreview) {
			this.props.onCardPreview(date, cards);
		}
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
			text: "Failed to load activity calendar.",
		});
	}

	/**
	 * Clean up card
	 */
	override destroy(): void {
		this.statsCard.destroy();
		super.destroy();
	}
}
