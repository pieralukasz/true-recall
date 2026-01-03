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

	constructor(app: App, options: BaseModalOptions) {
		super(app);
		this.modalTitle = options.title;
		this.modalWidth = options.width ?? "fit-content";
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		// Add base class
		contentEl.addClass("episteme-modal");

		// Set width on .modal container
		modalEl.style.width = this.modalWidth;

		// Render header with title
		this.renderHeader(contentEl);

		// Render body content (implemented by subclasses)
		const bodyEl = contentEl.createDiv({ cls: "episteme-modal-body" });
		this.renderBody(bodyEl);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: "episteme-modal-header" });
		header.createEl("h2", { text: this.modalTitle });
		// Close button is rendered by Obsidian, we position it via CSS
	}

	/**
	 * Render the modal body content
	 * Must be implemented by subclasses
	 */
	protected abstract renderBody(container: HTMLElement): void;
}
