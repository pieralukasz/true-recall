import { jsx as _jsx } from "preact/jsx-runtime";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { MoveCardBody } from "@true-recall/obsidian/modals/shared/move-card/MoveCardBody";
import { render } from "preact";
export class MoveCardModal extends BasePromiseModal {
    constructor(app, options) {
        super(app, {
            title: options.cardCount === 1
                ? "Move flashcard to..."
                : `Move ${options.cardCount} flashcards to...`,
            width: "500px",
        });
        this.allNotes = [];
        this.options = options;
    }
    getDefaultResult() {
        return { cancelled: true, targetNotePath: null };
    }
    onOpen() {
        super.onOpen();
        this.contentEl.addClass("true-recall-move-card-modal");
        this.allNotes = this.getValidNotes();
    }
    renderBody(container) {
        render(_jsx(MoveCardBody, { allNotes: this.allNotes, app: this.app, cardQuestion: this.options.cardQuestion, cardAnswer: this.options.cardAnswer, onResolve: (result) => this.resolve(result) }), container);
    }
    getValidNotes() {
        return this.app.vault.getMarkdownFiles().filter((file) => {
            if (this.options.sourceNoteName &&
                file.basename === this.options.sourceNoteName) {
                return false;
            }
            return true;
        });
    }
}
