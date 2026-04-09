import type { App } from "obsidian";
import { render } from "preact";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type {
	CardMaturityBreakdown,
	FSRSFlashcardItem,
} from "@true-recall/core/types";

import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import {
	CardPreviewBody,
	handleDeleteAll,
	handleDeleteCard,
	handleUnburyAll,
	handleUnburyCard,
	openSourceNote,
} from "@true-recall/obsidian/modals/shared/card-preview";

export interface CardPreviewModalOptions {
	title: string;
	cards: FSRSFlashcardItem[];
	flashcardManager: FlashcardManager;
	category?: keyof CardMaturityBreakdown;
}

export class CardPreviewModal extends BaseModal {
	private options: CardPreviewModalOptions;
	private flashcardManager: FlashcardManager;

	constructor(app: App, options: CardPreviewModalOptions) {
		super(app, { title: options.title, width: "700px" });
		this.options = options;
		this.flashcardManager = options.flashcardManager;
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-card-preview-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CardPreviewBody
				initialCards={this.options.cards}
				category={this.options.category}
				onDeleteCard={(card, setCards) => {
					void handleDeleteCard(
						this.app,
						card,
						setCards,
						this.options.cards,
						this.flashcardManager,
					).then((updated) => {
						this.options.cards = updated;
					});
				}}
				onOpenCard={(card) =>
					void openSourceNote(card, this.app, () => this.close())
				}
				onUnburyCard={(card, setCards) => {
					const updated = handleUnburyCard(
						card,
						setCards,
						this.options.cards,
						this.flashcardManager,
					);
					this.options.cards = updated;
				}}
				onUnburyAll={(cards, setCards) => {
					handleUnburyAll(cards, setCards, this.flashcardManager);
					this.options.cards = [];
				}}
				onDeleteAll={(cards, setCards) => {
					void handleDeleteAll(
						this.app,
						cards,
						setCards,
						this.flashcardManager,
					);
					this.options.cards = [];
				}}
				onUpdateTitle={(title) => this.updateTitle(title)}
			/>,
			container,
		);
	}
}
