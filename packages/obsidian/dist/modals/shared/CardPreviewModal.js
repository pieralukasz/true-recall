import { jsx as _jsx } from "preact/jsx-runtime";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { CardPreviewBody, handleDeleteAll, handleDeleteCard, handleUnburyAll, handleUnburyCard, openSourceNote, } from "@true-recall/obsidian/modals/shared/card-preview";
import { render } from "preact";
export class CardPreviewModal extends BaseModal {
    constructor(app, options) {
        super(app, { title: options.title, width: "700px" });
        this.options = options;
        this.flashcardManager = options.flashcardManager;
    }
    onOpen() {
        super.onOpen();
        this.contentEl.addClass("true-recall-card-preview-modal");
    }
    renderBody(container) {
        render(_jsx(CardPreviewBody, { initialCards: this.options.cards, category: this.options.category, onDeleteCard: (card, setCards) => {
                void handleDeleteCard(this.app, card, setCards, this.options.cards, this.flashcardManager).then((updated) => {
                    this.options.cards = updated;
                });
            }, onOpenCard: (card) => void openSourceNote(card, this.app, () => this.close()), onUnburyCard: (card, setCards) => {
                const updated = handleUnburyCard(card, setCards, this.options.cards, this.flashcardManager);
                this.options.cards = updated;
            }, onUnburyAll: (cards, setCards) => {
                handleUnburyAll(cards, setCards, this.flashcardManager);
                this.options.cards = [];
            }, onDeleteAll: (cards, setCards) => {
                void handleDeleteAll(this.app, cards, setCards, this.flashcardManager);
                this.options.cards = [];
            }, onUpdateTitle: (title) => this.updateTitle(title) }), container);
    }
}
