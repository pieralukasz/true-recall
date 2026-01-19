/**
 * Ready to Harvest Header Component
 * Displays title and count of notes ready to harvest
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface ReadyToHarvestHeaderProps {
	count: number;
	isLoading: boolean;
	onRefresh: () => void;
}

/**
 * Header component for ready to harvest view
 */
export class ReadyToHarvestHeader extends BaseComponent {
	private props: ReadyToHarvestHeaderProps;

	constructor(container: HTMLElement, props: ReadyToHarvestHeaderProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-ready-harvest-header",
		});

		// Title row
		const titleRow = this.element.createDiv({
			cls: "episteme-ready-harvest-title-row",
		});

		titleRow.createSpan({
			cls: "episteme-ready-harvest-title",
			text: "Ready to Harvest",
		});

		// Refresh button
		const refreshBtn = titleRow.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, "refresh-cw");
		this.events.addEventListener(refreshBtn, "click", () => {
			this.props.onRefresh();
		});

		// Summary section
		const summaryEl = this.element.createDiv({
			cls: "episteme-ready-summary",
		});

		if (this.props.isLoading) {
			summaryEl.createDiv({
				text: "Scanning vault...",
				cls: "episteme-ready-label",
			});
		} else {
			summaryEl.createDiv({
				text: this.props.count.toString(),
				cls: "episteme-ready-count",
			});
			summaryEl.createDiv({
				text: this.props.count === 1 ? "note ready to harvest" : "notes ready to harvest",
				cls: "episteme-ready-label",
			});
		}
	}

	updateProps(props: Partial<ReadyToHarvestHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
