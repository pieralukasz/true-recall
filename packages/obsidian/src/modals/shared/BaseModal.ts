import { type App, Modal } from "obsidian";
import { render } from "preact";

export interface BaseModalOptions {
	title: string;
	width?: string;
}

export abstract class BaseModal extends Modal {
	protected modalTitle: string;
	protected modalWidth: string;
	private bodyContainer: HTMLElement | null = null;

	constructor(app: App, options: BaseModalOptions) {
		super(app);
		this.modalTitle = options.title;
		this.modalWidth = options.width ?? "fit-content";
	}

	onOpen(): void {
		const { contentEl, modalEl, titleEl } = this;
		contentEl.empty();

		contentEl.addClass("true-recall-modal");

		modalEl.addClass("ep-modal-width");
		modalEl.style.setProperty("--ep-modal-width", this.modalWidth);

		titleEl.setText(this.modalTitle);

		this.bodyContainer = contentEl.createDiv();
		this.renderBody(this.bodyContainer);
	}

	onClose(): void {
		if (this.bodyContainer) {
			render(null, this.bodyContainer);
			this.bodyContainer = null;
		}
	}

	protected updateTitle(newTitle: string): void {
		this.modalTitle = newTitle;
		this.titleEl.setText(newTitle);
	}

	protected abstract renderBody(container: HTMLElement): void;
}
