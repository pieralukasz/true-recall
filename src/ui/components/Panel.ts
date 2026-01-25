/**
 * Panel Component
 * Shared panel structure for sidebar views (Projects, Ready to Harvest, etc.)
 * Uses consistent styling with NO container padding - elements handle their own spacing
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface PanelProps {
	title: string;
	onRefresh?: () => void;
	showFooter?: boolean;
	customHeader?: boolean;
	disableScroll?: boolean;
}

/**
 * Shared panel component that creates the view structure
 * Both header and content containers are exposed for views to add content
 */
export class Panel extends BaseComponent {
	private props: PanelProps;
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;
	private footerContainer: HTMLElement | null = null;

	constructor(container: HTMLElement, props: PanelProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Main container element - use absolute positioning to fill parent
		this.element = this.container.createDiv({
			cls: "ep:absolute ep:inset-0 ep:flex ep:flex-col ep:p-2",
		});

		// Header container
		this.headerContainer = this.element.createDiv({
			cls: this.props.customHeader
				? "ep:shrink-0"
				: "ep:shrink-0 ep:border-b ep:border-obs-border",
		});

		// Skip default title row if customHeader is true
		if (!this.props.customHeader) {
			// Render title row
			const header = this.headerContainer.createDiv({
				cls: "ep:py-2",
			});

			const titleRow = header.createDiv({
				cls: "ep:flex ep:items-center ep:justify-between ep:gap-2",
			});

			titleRow.createSpan({
				cls: "ep:font-semibold ep:text-obs-normal",
				text: this.props.title,
			});

			// Refresh button - just native Obsidian clickable-icon class
			if (this.props.onRefresh) {
				const refreshBtn = titleRow.createEl("button", {
					cls: "clickable-icon",
					attr: { "aria-label": "Refresh" },
				});
				setIcon(refreshBtn, "refresh-cw");
				this.events.addEventListener(refreshBtn, "click", () => {
					this.props.onRefresh?.();
				});
			}
		}

		// Content container
		this.contentContainer = this.element.createDiv({
			cls: this.props.disableScroll
				? "ep:flex-1 ep:min-h-0 ep:mt-2"
				: "ep:flex-1 ep:overflow-y-auto ep:min-h-0 ep:mt-2",
		});

		// Footer container - optional
		if (this.props.showFooter) {
			this.footerContainer = this.element.createDiv({
				cls: "ep:shrink-0",
			});
		}
	}

	/**
	 * Get header container to add additional content (e.g., summary section)
	 */
	getHeaderContainer(): HTMLElement {
		return this.headerContainer;
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
