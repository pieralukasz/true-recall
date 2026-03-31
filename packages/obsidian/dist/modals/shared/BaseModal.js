import { Modal } from "obsidian";
import { render } from "preact";
export class BaseModal extends Modal {
    constructor(app, options) {
        var _a;
        super(app);
        this.bodyContainer = null;
        this.modalTitle = options.title;
        this.modalWidth = (_a = options.width) !== null && _a !== void 0 ? _a : "fit-content";
    }
    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();
        contentEl.addClass("true-recall-modal");
        modalEl.addClass("ep-modal-width");
        modalEl.style.setProperty("--ep-modal-width", this.modalWidth);
        titleEl.setText(this.modalTitle);
        this.bodyContainer = contentEl.createDiv();
        this.renderBody(this.bodyContainer);
    }
    onClose() {
        if (this.bodyContainer) {
            render(null, this.bodyContainer);
            this.bodyContainer = null;
        }
    }
    updateTitle(newTitle) {
        this.modalTitle = newTitle;
        this.titleEl.setText(newTitle);
    }
}
