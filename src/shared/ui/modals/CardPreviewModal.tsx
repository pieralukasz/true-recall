import { type App, Component } from "obsidian";
import { render } from "preact";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { CardMaturityBreakdown, FSRSFlashcardItem } from "@shared/types";
import { BaseModal } from "@shared/ui/modals/BaseModal";
import {
	CardPreviewBody,
	handleDeleteAll,
	handleDeleteCard,
	handleUnburyAll,
	handleUnburyCard,
	openSourceNote,
} from "@shared/ui/modals/card-preview";

export interface CardPreviewModalOptions {
	title: string;
	cards: FSRSFlashcardItem[];
	flashcardManager: FlashcardManager;
	category?: keyof CardMaturityBreakdown;
}

export class CardPreviewModal extends BaseModal {
	private options: CardPreviewModalOptions;
	private component: Component;
	private flashcardManager: FlashcardManager;
	private unmountBody?: () => void;

	constructor(app: App, options: CardPreviewModalOptions) {
		super(app, { title: options.title, width: "700px" });
		this.options = options;
		this.component = new Component();
		this.flashcardManager = options.flashcardManager;
	}

	onOpen(): void {
		this.component.load();
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
					void handleUnburyCard(
						card,
						setCards,
						this.options.cards,
						this.flashcardManager,
					).then((updated) => {
						this.options.cards = updated;
					});
				}}
				onUnburyAll={(cards, setCards) => {
					void handleUnburyAll(
						cards,
						setCards,
						this.flashcardManager,
					).then(() => {
						this.options.cards = [];
					});
				}}
				onDeleteAll={(cards, setCards) => {
					void handleDeleteAll(
						cards,
						setCards,
						this.flashcardManager,
					).then(() => {
						this.options.cards = [];
					});
				}}
				onUpdateTitle={(title) => this.updateTitle(title)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		this.component.unload();
		const { contentEl } = this;
		contentEl.empty();
	}
}
