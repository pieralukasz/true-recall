/**
 * SectionHeader Component
 * Consistent section title with optional action buttons
 */
import { Platform, setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface SectionHeaderAction {
	icon: string;
	ariaLabel: string;
	onClick: () => void;
}

export interface SectionHeaderProps {
	title: string;
	/** Right-side action buttons */
	actions?: SectionHeaderAction[];
	/** Hide entire header on mobile */
	hideOnMobile?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Section header with title and optional action buttons
 */
export class SectionHeader extends BaseComponent {
	private props: SectionHeaderProps;

	constructor(container: HTMLElement, props: SectionHeaderProps) {
		super(container);
		this.props = {
			hideOnMobile: false,
			...props,
		};
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { title, actions, hideOnMobile, className } = this.props;

		// Skip rendering on mobile if hideOnMobile is true
		if (hideOnMobile && Platform.isMobile) {
			this.element = this.container.createDiv();
			return;
		}

		// Container with flex layout
		const classes = ["ep:flex", "ep:items-center", "ep:justify-between"];
		if (className) {
			classes.push(className);
		}

		this.element = this.container.createDiv({
			cls: classes.join(" "),
		});

		// Title
		this.element.createDiv({
			cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",
			text: title,
		});

		// Actions container (if any actions provided)
		if (actions && actions.length > 0) {
			const actionsContainer = this.element.createDiv({
				cls: "ep:flex ep:items-center ep:gap-1",
			});

			for (const action of actions) {
				const btn = actionsContainer.createEl("button", {
					cls: "clickable-icon",
					attr: { "aria-label": action.ariaLabel },
				});
				setIcon(btn, action.icon);
				this.events.addEventListener(btn, "click", () => {
					action.onClick();
				});
			}
		}
	}

	updateProps(props: Partial<SectionHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Factory function to create SectionHeader
 */
export function createSectionHeader(
	container: HTMLElement,
	props: SectionHeaderProps
): SectionHeader {
	const component = new SectionHeader(container, props);
	component.render();
	return component;
}
