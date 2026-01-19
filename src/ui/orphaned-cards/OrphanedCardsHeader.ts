/**
 * Orphaned Cards Header Component
 * Displays title, count, and bulk action buttons
 */
import { BaseComponent } from "../component.base";

export interface OrphanedCardsHeaderProps {
	count: number;
	selectedCount: number;
	isLoading: boolean;
	onBulkAssign: () => void;
	onBulkDelete: () => void;
}

/**
 * Header component for orphaned cards view
 */
export class OrphanedCardsHeader extends BaseComponent {
	private props: OrphanedCardsHeaderProps;

	constructor(container: HTMLElement, props: OrphanedCardsHeaderProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-panel-header",
		});

		// Title row
		const titleRow = this.element.createDiv({
			cls: "episteme-panel-title-row",
		});

		titleRow.createSpan({
			cls: "episteme-panel-title",
			text: "Orphaned Cards",
		});

		// Summary section
		const summaryEl = this.element.createDiv({
			cls: "episteme-panel-summary",
		});

		if (this.props.isLoading) {
			summaryEl.createDiv({
				text: "Loading...",
				cls: "episteme-panel-label",
			});
		} else {
			summaryEl.createDiv({
				text: this.props.count.toString(),
				cls: "episteme-panel-count",
			});
			summaryEl.createDiv({
				text: this.props.count === 1 ? "card without source" : "cards without source",
				cls: "episteme-panel-label",
			});
		}

		// Bulk action buttons (visible when cards are selected)
		if (this.props.selectedCount > 0) {
			const actionsRow = this.element.createDiv({
				cls: "episteme-panel-actions",
			});

			actionsRow.createSpan({
				text: `${this.props.selectedCount} selected`,
				cls: "episteme-panel-selected-count",
			});

			const assignBtn = actionsRow.createEl("button", {
				text: "Assign to note",
				cls: "episteme-panel-action-btn episteme-btn-primary",
			});
			this.events.addEventListener(assignBtn, "click", () => {
				this.props.onBulkAssign();
			});

			const deleteBtn = actionsRow.createEl("button", {
				text: "Delete",
				cls: "episteme-panel-action-btn episteme-btn-danger",
			});
			this.events.addEventListener(deleteBtn, "click", () => {
				this.props.onBulkDelete();
			});
		}
	}

	updateProps(props: Partial<OrphanedCardsHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
