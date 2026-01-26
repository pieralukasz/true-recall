/**
 * StatsCard Component
 * Base card component providing elegant, consistent styling for all stats sections
 * Features: shadow elevation, rounded corners, hover effects, optional header
 */
import { BaseComponent } from "../../component.base";

export interface StatsCardProps {
	/** Optional card title */
	title?: string;
	/** Optional icon for the header */
	icon?: string;
	/** Optional action button in header */
	action?: {
		label: string;
		onClick: () => void;
	};
	/** Whether to apply hover lift effect */
	hoverLift?: boolean;
	/** Custom CSS classes for the card container */
	customClasses?: string;
}

/**
 * StatsCard - Elegant card wrapper with shadow and hover effects
 * All stats sections should be wrapped in this component for consistent styling
 */
export class StatsCard extends BaseComponent {
	private props: StatsCardProps;
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;

	constructor(container: HTMLElement, props: StatsCardProps = {}) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Build card classes
		const cardClasses = [
			// Layout
			"ep:mb-5", // Margin between cards
			"ep:p-5", // Generous padding

			// Rounded corners
			"ep:rounded-lg", // 16px radius for elegance

			// Background - NO border, NO shadow
			"ep:bg-obs-secondary", // Secondary background

			// NO shadow - shadows use hard-coded black colors that look like borders
			// Transitions
			"ep:transition-all", // Smooth all transitions
			"ep:duration-200", // Fast 200ms transition
		];

		// Add hover lift effect if enabled
		if (this.props.hoverLift !== false) {
			cardClasses.push("ep:hover:-translate-y-px"); // Subtle lift
		}

		// Add custom classes if provided
		if (this.props.customClasses) {
			cardClasses.push(this.props.customClasses);
		}

		// Create card element
		this.element = this.container.createDiv({
			cls: cardClasses.join(" "),
		});

		// Create header if title provided
		if (this.props.title) {
			this.createHeader();
		}

		// Create content container
		this.contentContainer = this.element.createDiv({
			cls: this.props.title ? "" : "", // No extra classes if no header
		});
	}

	/**
	 * Create the header section with title and optional action
	 */
	private createHeader(): void {
		this.headerContainer = this.element!.createDiv({
			cls: [
				"ep:flex",
				"ep:items-center",
				"ep:justify-between",
				"ep:mb-4", // Bottom margin
				"ep:pb-3", // Bottom padding
				"ep:border-b", // Bottom border
				"ep:border-obs-border", // Plain border for internal divider
			].join(" "),
		});

		// Title row
		const titleRow = this.headerContainer.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		// Icon if provided
		if (this.props.icon) {
			titleRow.createSpan({
				cls: "ep:text-xl",
				text: this.props.icon,
			});
		}

		// Title
		titleRow.createSpan({
			cls: [
				"ep:text-ui-large", // Large text
				"ep:font-semibold", // Semibold
				"ep:text-obs-normal", // Normal color
				"ep:tracking-tight", // Tight letter spacing
			].join(" "),
			text: this.props.title,
		});

		// Action button if provided
		if (this.props.action) {
			const actionBtn = titleRow.createEl("button", {
				cls: [
					"ep:px-3",
					"ep:py-1.5",
					"ep:rounded-md",
					"ep:text-ui-small",
					"ep:font-medium",
					"ep:bg-obs-interactive",
					"ep:text-white",
					"ep:transition-all",
					"ep:duration-200",
					"ep:hover:bg-obs-interactive-hover",
					"ep:hover:shadow-sm",
				].join(" "),
				text: this.props.action.label,
			});
			this.events.addEventListener(actionBtn, "click", this.props.action.onClick);
		}
	}

	/**
	 * Get the header container to add additional content
	 */
	getHeaderContainer(): HTMLElement {
		return this.headerContainer;
	}

	/**
	 * Get the content container to render card content
	 */
	getContentContainer(): HTMLElement {
		return this.contentContainer;
	}
}
