/**
 * CardCountDisplay Component
 * Anki-style colored count display (New · Learning · Due)
 */
import { BaseComponent } from "../component.base";

export interface CardCountDisplayProps {
	newCount: number;
	learningCount: number;
	dueCount: number;
	/** "full" = New · Learning · Due, "compact" = New · Due only */
	variant?: "full" | "compact";
	/** Text size class */
	size?: "smaller" | "small";
	/** Apply font-medium class */
	bold?: boolean;
}

/**
 * Displays card counts in Anki-style format with colors
 * - New: blue
 * - Learning: orange
 * - Due/Review: green
 */
export class CardCountDisplay extends BaseComponent {
	private props: CardCountDisplayProps;

	constructor(container: HTMLElement, props: CardCountDisplayProps) {
		super(container);
		this.props = {
			variant: "full",
			size: "smaller",
			bold: true,
			...props,
		};
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { newCount, learningCount, dueCount, variant, size, bold } =
			this.props;

		const sizeClass = size === "small" ? "ep:text-ui-small" : "ep:text-ui-smaller";
		const fontClass = bold ? "ep:font-medium" : "";

		this.element = this.container.createSpan({
			cls: `ep:flex ep:items-center ep:gap-1 ${fontClass} ${sizeClass}`,
		});

		// New count (blue)
		this.element.createSpan({
			text: String(newCount),
			cls: "ep:text-blue-500",
		});

		this.element.createSpan({ text: "·", cls: "ep:text-obs-faint" });

		// Learning count (orange) - only in full variant
		if (variant === "full") {
			this.element.createSpan({
				text: String(learningCount),
				cls: "ep:text-orange-500",
			});

			this.element.createSpan({ text: "·", cls: "ep:text-obs-faint" });
		}

		// Due/Review count (green)
		this.element.createSpan({
			text: String(dueCount),
			cls: "ep:text-green-500",
		});
	}

	updateProps(props: Partial<CardCountDisplayProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Factory function to create CardCountDisplay
 */
export function createCardCountDisplay(
	container: HTMLElement,
	props: CardCountDisplayProps
): CardCountDisplay {
	const component = new CardCountDisplay(container, props);
	component.render();
	return component;
}
