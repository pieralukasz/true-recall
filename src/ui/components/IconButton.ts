/**
 * IconButton Component
 * Consistent clickable icon button with optional text label
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface IconButtonProps {
	icon: string;
	ariaLabel: string;
	onClick: () => void;
	/** Optional text label after icon */
	label?: string;
	/** Size variant */
	size?: "small" | "medium";
	/** Danger styling (red on hover) */
	danger?: boolean;
	/** Disabled state */
	disabled?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Clickable icon button using Obsidian's clickable-icon styling
 */
export class IconButton extends BaseComponent {
	private props: IconButtonProps;
	private buttonEl: HTMLButtonElement | null = null;

	constructor(container: HTMLElement, props: IconButtonProps) {
		super(container);
		this.props = {
			size: "medium",
			danger: false,
			disabled: false,
			...props,
		};
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { icon, ariaLabel, onClick, label, size, danger, disabled, className } =
			this.props;

		// Build CSS classes
		const classes: string[] = ["clickable-icon"];

		if (size === "small") {
			classes.push(
				"ep:cursor-pointer",
				"ep:w-6",
				"ep:h-6",
				"ep:flex",
				"ep:items-center",
				"ep:justify-center",
				"ep:rounded",
				"ep:text-obs-muted",
				"ep:hover:bg-obs-modifier-hover",
				"ep:hover:text-obs-normal",
				"ep:transition-colors",
				"[&_svg]:ep:w-3.5",
				"[&_svg]:ep:h-3.5"
			);
		} else {
			classes.push(
				"ep:cursor-pointer",
				"ep:flex",
				"ep:items-center",
				"ep:justify-center",
				"ep:rounded",
				"ep:text-obs-muted",
				"ep:hover:bg-obs-modifier-hover",
				"ep:hover:text-obs-normal",
				"ep:transition-colors"
			);
		}

		if (label) {
			classes.push("ep:gap-1");
		}

		if (danger) {
			classes.push("ep:hover:text-red-500");
		}

		if (disabled) {
			classes.push("ep:opacity-50", "ep:cursor-not-allowed");
		}

		if (className) {
			classes.push(className);
		}

		this.buttonEl = this.container.createEl("button", {
			cls: classes.join(" "),
			attr: { "aria-label": ariaLabel },
		});

		if (disabled) {
			this.buttonEl.disabled = true;
		}

		setIcon(this.buttonEl, icon);

		if (label) {
			this.buttonEl.createSpan({
				text: label,
				cls: "ep:text-ui-small",
			});
		}

		if (!disabled) {
			this.events.addEventListener(this.buttonEl, "click", (e) => {
				e.stopPropagation();
				onClick();
			});
		}

		this.element = this.buttonEl;
	}

	updateProps(props: Partial<IconButtonProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	setDisabled(disabled: boolean): void {
		this.props.disabled = disabled;
		if (this.buttonEl) {
			this.buttonEl.disabled = disabled;
			if (disabled) {
				this.buttonEl.addClass("ep:opacity-50", "ep:cursor-not-allowed");
			} else {
				this.buttonEl.removeClass("ep:opacity-50", "ep:cursor-not-allowed");
			}
		}
	}
}

/**
 * Factory function to create IconButton
 */
export function createIconButton(
	container: HTMLElement,
	props: IconButtonProps
): IconButton {
	const component = new IconButton(container, props);
	component.render();
	return component;
}
