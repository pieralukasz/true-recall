/**
 * Collapsible Section Component
 * Expandable/collapsible section with toggle header and content area
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface CollapsibleSectionProps {
	/** Section title displayed in the header */
	title: string;
	/** Optional icon name to display before the title */
	icon?: string;
	/** Whether the section starts expanded */
	defaultExpanded?: boolean;
	/** Optional description shown in the header row */
	description?: string;
	/** Whether to show a border at the top */
	showTopBorder?: boolean;
	/** Custom CSS classes for the container */
	className?: string;
	/** Callback when expanded state changes */
	onToggle?: (isExpanded: boolean) => void;
	/** Function to render the section content when expanded */
	renderContent: (container: HTMLElement) => void;
}

/**
 * Collapsible section with toggle header
 */
export class CollapsibleSection extends BaseComponent {
	private props: CollapsibleSectionProps;
	private isExpanded: boolean;
	private contentContainer: HTMLElement | null = null;

	constructor(container: HTMLElement, props: CollapsibleSectionProps) {
		super(container);
		this.props = props;
		this.isExpanded = props.defaultExpanded ?? false;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { title, icon, description, showTopBorder, className } = this.props;

		// Container with optional top border
		const containerCls = [
			showTopBorder ? "ep:pt-3 ep:border-t ep:border-obs-border" : "",
			className ?? "",
		]
			.filter(Boolean)
			.join(" ");

		this.element = this.container.createDiv({
			cls: containerCls || undefined,
		});

		// Toggle row (header)
		const toggleRow = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors",
		});

		// Chevron icon
		const toggleIcon = toggleRow.createSpan({
			cls: "ep:w-4 ep:h-4 ep:transition-transform",
		});
		setIcon(toggleIcon, this.isExpanded ? "chevron-down" : "chevron-right");

		// Optional leading icon
		if (icon) {
			const leadingIcon = toggleRow.createSpan({ cls: "ep:w-4 ep:h-4" });
			setIcon(leadingIcon, icon);
		}

		// Title
		toggleRow.createSpan({
			text: title,
			cls: "ep:text-ui-smaller ep:font-medium",
		});

		// Optional description
		if (description) {
			toggleRow.createSpan({
				text: `(${description})`,
				cls: "ep:text-ui-smaller ep:opacity-70",
			});
		}

		// Click handler
		this.events.addEventListener(toggleRow, "click", () => {
			this.toggle();
		});

		// Content container (always present but conditionally filled)
		this.contentContainer = this.element.createDiv({
			cls: this.isExpanded ? "ep:mt-2" : "ep:hidden",
		});

		// Render content if expanded
		if (this.isExpanded) {
			this.props.renderContent(this.contentContainer);
		}
	}

	/**
	 * Toggle expanded state
	 */
	toggle(): void {
		this.setExpanded(!this.isExpanded);
	}

	/**
	 * Set expanded state explicitly
	 */
	setExpanded(expanded: boolean): void {
		if (this.isExpanded === expanded) return;

		this.isExpanded = expanded;
		this.props.onToggle?.(expanded);
		this.render();
	}

	/**
	 * Get current expanded state
	 */
	getIsExpanded(): boolean {
		return this.isExpanded;
	}

	/**
	 * Re-render just the content area (useful for partial updates)
	 */
	refreshContent(): void {
		if (!this.contentContainer) return;

		this.contentContainer.empty();
		if (this.isExpanded) {
			this.props.renderContent(this.contentContainer);
		}
	}

	/**
	 * Update props and re-render
	 */
	updateProps(props: Partial<CollapsibleSectionProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Factory function to create and render collapsible section
 */
export function createCollapsibleSection(
	container: HTMLElement,
	props: CollapsibleSectionProps
): CollapsibleSection {
	const section = new CollapsibleSection(container, props);
	section.render();
	return section;
}
