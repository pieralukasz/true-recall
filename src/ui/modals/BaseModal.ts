/**
 * Base Modal Component
 * Provides consistent styling and structure for all plugin modals
 */
import { App, Modal } from "obsidian";

export interface BaseModalOptions {
	title: string;
	width?: string; // e.g. "500px", defaults to "fit-content"
}

/**
 * Abstract base class for plugin modals
 * Provides consistent header with title and close button alignment
 */
export abstract class BaseModal extends Modal {
	protected modalTitle: string;
	protected modalWidth: string;
	private headerTitleEl: HTMLElement | null = null;

	constructor(app: App, options: BaseModalOptions) {
		super(app);
		this.modalTitle = options.title;
		this.modalWidth = options.width ?? "fit-content";
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		// Add base class (keep for CSS selectors that need :has() targeting)
		contentEl.addClass("episteme-modal");

		// Set width on .modal container
		modalEl.style.width = this.modalWidth;

		// Render header with title
		this.renderHeader(contentEl);

		// Render body content (implemented by subclasses)
		const bodyEl = contentEl.createDiv({
			cls: "ep:py-2.5 ep:px-3",
		});
		this.renderBody(bodyEl);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:py-2.5 ep:px-3 ep:pr-10 ep:border-b ep:border-obs-border",
		});
		this.headerTitleEl = header.createEl("h2", { text: this.modalTitle });
		this.headerTitleEl.addClasses(["ep:m-0", "ep:text-ui-large", "ep:font-semibold"]);
		// Close button is rendered by Obsidian, we position it via CSS
	}

	/**
	 * Update the modal title dynamically
	 */
	protected updateTitle(newTitle: string): void {
		this.modalTitle = newTitle;
		if (this.headerTitleEl) {
			this.headerTitleEl.textContent = newTitle;
		}
	}

	/**
	 * Render the modal body content
	 * Must be implemented by subclasses
	 */
	protected abstract renderBody(container: HTMLElement): void;
}
