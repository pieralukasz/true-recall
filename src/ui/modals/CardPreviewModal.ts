/**
 * Card Preview Modal
 * Displays a list of flashcards with preview and navigation to source note
 */
import { App, Component, Notice, TFile } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";
import { BaseModal } from "./BaseModal";
import type { FlashcardManager } from "../../services";
import { createCardReviewItem, type CardData } from "../components/CardReviewItem";

export interface CardPreviewModalOptions {
	title: string;
	cards: FSRSFlashcardItem[];
	flashcardManager: FlashcardManager;
}

/**
 * Modal for previewing a list of flashcards
 */
export class CardPreviewModal extends BaseModal {
	private options: CardPreviewModalOptions;
	private component: Component;
	private flashcardManager: FlashcardManager;

	constructor(app: App, options: CardPreviewModalOptions) {
		super(app, { title: options.title, width: "700px" });
		this.options = options;
		this.component = new Component();
		this.flashcardManager = options.flashcardManager;
	}

	onOpen(): void {
		this.component.load();
		super.onOpen();
		this.contentEl.addClass("episteme-card-preview-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Cards count
		const countEl = container.createDiv({ cls: "episteme-card-preview-count" });
		countEl.setText(`${this.options.cards.length} cards`);

		// Cards list
		const listEl = container.createDiv({ cls: "episteme-card-preview-list" });

		if (this.options.cards.length === 0) {
			listEl.createDiv({
				cls: "episteme-card-preview-empty",
				text: "No cards in this category",
			});
			return;
		}

		for (const card of this.options.cards) {
			createCardReviewItem(listEl, {
				card,
				filePath: card.filePath,
				app: this.app,
				component: this.component,
				onDelete: (card) => void this.handleDeleteCard(card),
				onOpen: (card) => void this.openSourceNote(card),
			});
		}
	}

	onClose(): void {
		this.component.unload();
		const { contentEl } = this;
		contentEl.empty();
	}

	private async handleDeleteCard(card: CardData): Promise<void> {
		const confirmed = confirm("Delete this flashcard? This action cannot be undone.");
		if (!confirmed) return;

		// For FSRSFlashcardItem, we have the filePath directly
		// For FlashcardItem, we need to get it from the context
		const filePath = "filePath" in card ? card.filePath : this.options.cards.find(c => c.id === card.id)?.filePath;
		if (!filePath) {
			new Notice("Could not find flashcard file path");
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice("Could not find flashcard file");
			return;
		}

		const success = await this.flashcardManager.removeFlashcardDirect(file, card.lineNumber);

		if (success) {
			new Notice("Flashcard deleted");
			// Remove card from list (filter by id since card types differ)
			this.options.cards = this.options.cards.filter(c => c.id !== card.id);
			// Re-render
			this.renderBody(this.contentEl);
			// Update title
			this.updateTitle(`${this.options.cards.length} cards`);
		} else {
			new Notice("Failed to delete flashcard");
		}
	}

	private async openSourceNote(card: CardData): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);

		// For FSRSFlashcardItem, try to open the original source note if available
		if ("sourceNoteName" in card && card.sourceNoteName) {
			const sourceFile = this.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === card.sourceNoteName);
			if (sourceFile) {
				await leaf.openFile(sourceFile);
				this.close();
				return;
			}
		}

		// Fallback to flashcard file
		const filePath = "filePath" in card ? card.filePath : this.options.cards.find(c => c.id === card.id)?.filePath;
		if (!filePath) {
			new Notice("Could not find flashcard file path");
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			await leaf.openFile(file, {
				eState: { line: card.lineNumber },
			});
			this.close();
		}
	}
}
