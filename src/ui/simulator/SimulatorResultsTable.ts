/**
 * Simulator Results Table Component
 * Displays interval progression for each sequence
 */
import { BaseComponent } from "../component.base";
import type { SimulatorStateManager } from "../../state/simulator.state";

interface SimulatorResultsTableProps {
	stateManager: SimulatorStateManager;
}

export class SimulatorResultsTable extends BaseComponent {
	private props: SimulatorResultsTableProps;
	private tableBody: HTMLTableSectionElement | null = null;
	private tableHead: HTMLTableSectionElement | null = null;

	constructor(container: HTMLElement, props: SimulatorResultsTableProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		this.element = this.container.createDiv({
			cls: "ep:bg-obs-secondary ep:rounded-lg ep:p-4",
		});

		const table = this.element.createEl("table", {
			cls: "ep:w-full ep:text-ui-small",
		});

		this.tableHead = table.createEl("thead");
		this.tableBody = table.createEl("tbody");

		this.updateTable();
	}

	update(): void {
		this.updateTable();
	}

	/**
	 * Update table content
	 */
	private updateTable(): void {
		if (!this.tableHead || !this.tableBody) return;

		const simulations = this.props.stateManager.getSimulations();

		// Get max review count
		const maxReviews = Math.max(
			...simulations.map((s) => s.reviews.length),
			1
		);

		// Update header
		this.tableHead.empty();
		const headerRow = this.tableHead.createEl("tr");

		// Grade column
		headerRow.createEl("th", {
			text: "Grade",
			cls: this.getHeaderCellCls(),
		});

		// Interval columns
		for (let i = 0; i < maxReviews; i++) {
			headerRow.createEl("th", {
				text: `Ivl-${i}`,
				cls: this.getHeaderCellCls(),
			});
		}

		// Update body
		this.tableBody.empty();

		for (const sim of simulations) {
			const row = this.tableBody.createEl("tr", {
				cls: "ep:border-b ep:border-obs-border last:ep:border-b-0",
			});

			// Sequence cell with color indicator
			const seqCell = row.createEl("td", {
				cls: this.getBodyCellCls(),
			});

			const seqContent = seqCell.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2",
			});

			// Color dot
			const colorDot = seqContent.createDiv({
				cls: "ep:w-3 ep:h-3 ep:rounded-full ep:flex-shrink-0",
			});
			colorDot.style.backgroundColor = sim.color;

			seqContent.createSpan({
				text: sim.sequence,
				cls: "ep:font-mono",
			});

			// Interval cells
			for (let i = 0; i < maxReviews; i++) {
				const review = sim.reviews[i];
				const interval = review ? Math.round(review.interval) : "-";

				row.createEl("td", {
					text: String(interval),
					cls: `${this.getBodyCellCls()} ep:text-center ep:font-mono`,
				});
			}
		}
	}

	/**
	 * Get header cell classes
	 */
	private getHeaderCellCls(): string {
		return [
			"ep:py-2 ep:px-3",
			"ep:text-left ep:font-semibold",
			"ep:text-obs-muted ep:text-ui-smaller ep:uppercase",
			"ep:border-b ep:border-obs-border",
		].join(" ");
	}

	/**
	 * Get body cell classes
	 */
	private getBodyCellCls(): string {
		return "ep:py-2 ep:px-3 ep:text-obs-normal";
	}
}
