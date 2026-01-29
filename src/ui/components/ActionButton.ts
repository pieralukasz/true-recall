/**
 * ActionButton Component
 * Styled action button with primary/secondary/danger/seed variants
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export type ActionButtonVariant = "primary" | "secondary" | "danger" | "seed";

export interface ActionButtonProps {
	label: string;
	/** Click handler - optional if button is disabled */
	onClick?: () => void;
	variant: ActionButtonVariant;
	/** Optional icon before label */
	icon?: string;
	/** Disabled state */
	disabled?: boolean;
	/** Use flex-1 for equal width in button rows */
	fullWidth?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Styled action button with multiple variants
 */
export class ActionButton extends BaseComponent {
	private props: ActionButtonProps;
	private buttonEl: HTMLButtonElement | null = null;

	constructor(container: HTMLElement, props: ActionButtonProps) {
		super(container);
		this.props = {
			disabled: false,
			fullWidth: false,
			...props,
		};
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { label, onClick, variant, icon, disabled, fullWidth, className } =
			this.props;

		// Base classes for all buttons
		const baseClasses = [
			"ep:border-none",
			"ep:py-2.5",
			"ep:px-4",
			"ep:rounded-md",
			"ep:cursor-pointer",
			"ep:font-medium",
			"ep:text-ui-small",
			"ep:transition-colors",
		];

		if (fullWidth) {
			baseClasses.push("ep:flex-1");
		}

		if (icon) {
			baseClasses.push("ep:flex", "ep:items-center", "ep:gap-1.5", "ep:justify-center");
		}

		// Variant-specific classes
		const variantClasses = this.getVariantClasses(variant);

		// Disabled classes
		if (disabled) {
			baseClasses.push("ep:opacity-60", "ep:cursor-not-allowed");
		}

		// Additional classes
		if (className) {
			baseClasses.push(className);
		}

		this.buttonEl = this.container.createEl("button", {
			cls: [...baseClasses, ...variantClasses].join(" "),
		});

		if (icon) {
			const iconSpan = this.buttonEl.createSpan();
			setIcon(iconSpan, icon);
		}

		this.buttonEl.createSpan({ text: label });

		if (disabled) {
			this.buttonEl.disabled = true;
		} else if (onClick) {
			this.events.addEventListener(this.buttonEl, "click", (e) => {
				e.stopPropagation();
				onClick();
			});
		}

		this.element = this.buttonEl;
	}

	private getVariantClasses(variant: ActionButtonVariant): string[] {
		switch (variant) {
			case "primary":
				return ["mod-cta"];
			case "secondary":
				return [
					"ep:bg-obs-border",
					"ep:text-obs-normal",
					"ep:hover:bg-obs-modifier-hover",
				];
			case "danger":
				return [
					"ep:bg-red-500",
					"ep:text-white",
					"ep:hover:bg-red-600",
				];
			case "seed":
				return [
					"ep:bg-obs-border",
					"ep:text-obs-normal",
					"ep:font-semibold",
					"ep:hover:bg-amber-400",
					"ep:hover:text-white",
				];
			default:
				return [];
		}
	}

	updateProps(props: Partial<ActionButtonProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	setDisabled(disabled: boolean): void {
		this.props.disabled = disabled;
		if (this.buttonEl) {
			this.buttonEl.disabled = disabled;
			if (disabled) {
				this.buttonEl.classList.add("ep:opacity-60", "ep:cursor-not-allowed");
			} else {
				this.buttonEl.classList.remove("ep:opacity-60", "ep:cursor-not-allowed");
			}
		}
	}

	setLabel(label: string): void {
		this.props.label = label;
		if (this.buttonEl) {
			const textSpan = this.buttonEl.querySelector("span:last-child");
			if (textSpan) {
				textSpan.textContent = label;
			}
		}
	}
}

/**
 * Factory function to create ActionButton
 */
export function createActionButton(
	container: HTMLElement,
	props: ActionButtonProps
): ActionButton {
	const component = new ActionButton(container, props);
	component.render();
	return component;
}
