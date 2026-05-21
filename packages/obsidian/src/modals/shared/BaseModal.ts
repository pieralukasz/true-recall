import { type App, Modal } from "obsidian";
import { render } from "preact";

export interface BaseModalOptions {
	title: string;
	width?: string;
	/**
	 * Optional modifier classes added to modalEl and containerEl so CSS can
	 * target a specific modal without relying on `:has()` (which has poor
	 * selector-invalidation performance in large DOM trees).
	 */
	modifierClass?: string | string[];
}

export abstract class BaseModal extends Modal {
	protected modalTitle: string;
	protected modalWidth: string;
	private bodyContainer: HTMLElement | null = null;
	private modifierClasses: string[];

	constructor(app: App, options: BaseModalOptions) {
		super(app);
		this.modalTitle = options.title;
		this.modalWidth = options.width ?? "fit-content";
		this.modifierClasses = options.modifierClass
			? Array.isArray(options.modifierClass)
				? options.modifierClass
				: [options.modifierClass]
			: [];
	}

	onOpen(): void {
		const { contentEl, modalEl, containerEl, titleEl } = this;
		contentEl.empty();

		contentEl.addClass("true-recall-modal");

		modalEl.addClass("ep-modal-width");
		modalEl.addClass("tr-modal-host");
		containerEl.addClass("tr-modal-container-host");
		for (const cls of this.modifierClasses) {
			modalEl.addClass(cls);
			containerEl.addClass(`${cls}-container`);
		}
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
