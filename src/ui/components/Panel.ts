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

		// Main container element
		this.element = this.container.createDiv({
			cls: "episteme-panel",
		});

		// Header container - NO padding CSS defined
		this.headerContainer = this.element.createDiv({
			cls: "episteme-panel-header-container",
		});

		// Skip default title row if customHeader is true
		if (!this.props.customHeader) {
			// Render title row using Ready to Harvest styling classes
			const header = this.headerContainer.createDiv({
				cls: "episteme-ready-harvest-header",
			});

			const titleRow = header.createDiv({
				cls: "episteme-ready-harvest-title-row",
			});

			titleRow.createSpan({
				cls: "episteme-ready-harvest-title",
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

		// Content container - NO padding CSS defined
		this.contentContainer = this.element.createDiv({
			cls: "episteme-panel-content-container",
		});

		// Footer container - optional
		if (this.props.showFooter) {
			this.footerContainer = this.element.createDiv({
				cls: "episteme-panel-footer-container",
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
