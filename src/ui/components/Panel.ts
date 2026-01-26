/**
 * Panel Component
 * Shared panel structure for sidebar views
 * Uses native Obsidian header - this component only provides content/footer containers
 */
import { BaseComponent } from "../component.base";

export interface PanelProps {
	showFooter?: boolean;
	disableScroll?: boolean;
}

/**
 * Shared panel component that creates the view structure
 * Header is handled by native Obsidian view header with addAction()
 */
export class Panel extends BaseComponent {
	private props: PanelProps;
	private contentContainer!: HTMLElement;
	private footerContainer: HTMLElement | null = null;

	constructor(container: HTMLElement, props: PanelProps = {}) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Main container element - fill available space with flex
		this.element = this.container.createDiv({
			cls: "ep:h-full ep:flex ep:flex-col ep:px-1 ep:overflow-hidden",
		});

		// Content container
		this.contentContainer = this.element.createDiv({
			cls: this.props.disableScroll
				? "ep:flex-1 ep:min-h-0"
				: "ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		// Footer container - optional
		if (this.props.showFooter) {
			this.footerContainer = this.element.createDiv({
				cls: "ep:shrink-0",
			});
		}
	}

	/**
	 * Get content container to render view-specific content
	 */
	getContentContainer(): HTMLElement {
		return this.contentContainer;
	}

	/**
	 * Get footer container (only available when showFooter: true)
	 */
	getFooterContainer(): HTMLElement | null {
		return this.footerContainer;
	}

	updateProps(props: Partial<PanelProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
