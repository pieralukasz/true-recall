/**
 * SelectionFooter Component
 * Unified footer bar for selection mode with count display and action buttons
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export type SelectionFooterDisplay =
	| { type: "cardCounts"; newCount: number; learningCount: number; dueCount: number }
	| { type: "selectedCount"; count: number };

export interface SelectionFooterAction {
	label: string;
	icon?: string;
	onClick: () => void;
	variant?: "primary" | "secondary" | "danger";
	disabled?: boolean;
}

export interface SelectionFooterProps {
	/** What to display on the left side */
	display: SelectionFooterDisplay;
	/** Action buttons on the right side */
	actions: SelectionFooterAction[];
	/** Cancel/exit button handler (shows X button on left) */
	onCancel?: () => void;
}

/**
 * Footer for selection mode - supports both card counts and selected count displays
 */
export class SelectionFooter extends BaseComponent {
	private props: SelectionFooterProps;

	constructor(container: HTMLElement, props: SelectionFooterProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { display, actions, onCancel } = this.props;

		this.element = this.container.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary",
		});

		// Left side: Cancel button and display
		const leftSide = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		// Cancel button (if handler provided)
		if (onCancel) {
			const cancelBtn = leftSide.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": "Cancel selection" },
			});
			setIcon(cancelBtn, "x");
			this.events.addEventListener(cancelBtn, "click", () => onCancel());
		}

		// Display (card counts or selected count)
		if (display.type === "cardCounts") {
			this.renderCardCounts(leftSide, display);
		} else {
			leftSide.createSpan({
				text: `Selected: ${display.count}`,
				cls: "ep:text-ui-small ep:text-obs-normal ep:font-medium",
			});
		}

		// Right side: Action buttons
		if (actions.length > 0) {
			const actionsEl = this.element.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2",
			});

			for (const action of actions) {
				this.renderActionButton(actionsEl, action);
			}
		}
	}

	private renderCardCounts(
		container: HTMLElement,
		display: { type: "cardCounts"; newCount: number; learningCount: number; dueCount: number }
	): void {
		const countsEl = container.createSpan({
			cls: "ep:flex ep:items-center ep:gap-1 ep:font-medium ep:text-ui-small",
		});

		// New count (blue)
		countsEl.createSpan({
			text: String(display.newCount),
			cls: "ep:text-blue-500",
		});

		countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

		// Learning count (orange)
		countsEl.createSpan({
			text: String(display.learningCount),
			cls: "ep:text-orange-500",
		});

		countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

		// Due count (green)
		countsEl.createSpan({
			text: String(display.dueCount),
			cls: "ep:text-green-500",
		});
	}

	private renderActionButton(
		container: HTMLElement,
		action: SelectionFooterAction
	): void {
		const { label, icon, onClick, variant = "secondary", disabled = false } = action;

		const btnBase =
			"ep:flex ep:items-center ep:gap-1.5 ep:px-3 ep:py-1.5 ep:rounded ep:text-ui-small ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";

		let variantCls: string;
		switch (variant) {
			case "primary":
				variantCls = "mod-cta";
				break;
			case "danger":
				variantCls = "ep:bg-red-500/10 ep:text-red-500 ep:hover:bg-red-500 ep:hover:text-white";
				break;
			case "secondary":
			default:
				variantCls = "ep:bg-obs-modifier-hover ep:text-obs-normal ep:hover:bg-obs-interactive ep:hover:text-white";
				break;
		}

		const btn = container.createEl("button", {
			cls: `${btnBase} ${variantCls}`,
		});

		if (icon) {
			const iconEl = btn.createSpan({ cls: "ep:flex ep:items-center" });
			setIcon(iconEl, icon);
		}

		btn.createSpan({ text: label });

		if (disabled) {
			btn.disabled = true;
			btn.classList.add("ep:opacity-50", "ep:cursor-not-allowed");
		} else {
			this.events.addEventListener(btn, "click", () => onClick());
		}
	}

	updateProps(props: Partial<SelectionFooterProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Factory function to create SelectionFooter
 */
export function createSelectionFooter(
	container: HTMLElement,
	props: SelectionFooterProps
): SelectionFooter {
	const component = new SelectionFooter(container, props);
	component.render();
	return component;
}
