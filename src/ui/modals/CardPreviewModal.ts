/**
 * Card Preview Modal
 * Displays a list of flashcards with preview and navigation to source note
 */
import { App, Component, Notice, TFile } from "obsidian";
import type { FSRSFlashcardItem, CardMaturityBreakdown } from "../../types";
import { BaseModal } from "./BaseModal";
import type { FlashcardManager } from "../../services";
import { createCardReviewItem, type CardData } from "../components/CardReviewItem";

export interface CardPreviewModalOptions {
	title: string;
	cards: FSRSFlashcardItem[];
	flashcardManager: FlashcardManager;
	category?: keyof CardMaturityBreakdown;
}

/**
 * Modal for previewing a list of flashcards
 */
export class CardPreviewModal extends BaseModal {
	private options: CardPreviewModalOptions;
	private component: Component;
	private flashcardManager: FlashcardManager;
	private bodyContainer: HTMLElement | null = null;

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
		this.bodyContainer = container;
		container.empty();

		// Header with count and optional "Unbury All" button
		const headerEl = container.createDiv({ cls: "episteme-card-preview-header" });

		// Cards count
		const countEl = headerEl.createDiv({ cls: "episteme-card-preview-count" });
		countEl.setText(`${this.options.cards.length} cards`);

		// "Unbury All" button for buried cards category
		if (this.options.category === "buried" && this.options.cards.length > 0) {
			const unburyAllBtn = headerEl.createEl("button", {
				cls: "episteme-unbury-all-btn",
				text: "Unbury All",
			});
			unburyAllBtn.addEventListener("click", () => void this.handleUnburyAll());
		}

		// "Delete All" button for suspended cards category
		if (this.options.category === "suspended" && this.options.cards.length > 0) {
			const deleteAllBtn = headerEl.createEl("button", {
				cls: "episteme-delete-all-btn",
				text: "Delete All",
			});
			deleteAllBtn.addEventListener("click", () => void this.handleDeleteAll());
		}

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
				onUnbury: this.options.category === "buried" ? (card) => void this.handleUnburyCard(card) : undefined,
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

		const success = await this.flashcardManager.removeFlashcardById(card.id);

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
			// Open file and navigate to card using its ID
			await this.flashcardManager.openFileAtCard(file, card.id);
			this.close();
		}
	}

	private async handleUnburyCard(card: CardData): Promise<void> {
		// Find the full card data
		const fullCard = this.options.cards.find(c => c.id === card.id);
		if (!fullCard) {
			new Notice("Could not find card");
			return;
		}

		// Remove buriedUntil to unbury
		const updatedFsrs = { ...fullCard.fsrs, buriedUntil: undefined };

		try {
			this.flashcardManager.updateCardFSRS(
				fullCard.id,
				updatedFsrs
			);

			// Remove from list
			this.options.cards = this.options.cards.filter(c => c.id !== card.id);

			// Re-render
			if (this.bodyContainer) {
				this.renderBody(this.bodyContainer);
			}

			// Update title
			this.updateTitle(`${this.options.cards.length} cards`);

			new Notice("Card unburied");
		} catch (error) {
			console.error("Error unburying card:", error);
			new Notice("Failed to unbury card");
		}
	}

	private async handleUnburyAll(): Promise<void> {
		const cards = [...this.options.cards];
		let unburiedCount = 0;

		for (const card of cards) {
			const updatedFsrs = { ...card.fsrs, buriedUntil: undefined };

			try {
				this.flashcardManager.updateCardFSRS(
					card.id,
					updatedFsrs
				);
				unburiedCount++;
			} catch (error) {
				console.error(`Error unburying card ${card.id}:`, error);
			}
		}

		// Clear all cards from list
		this.options.cards = [];

		// Re-render
		if (this.bodyContainer) {
			this.renderBody(this.bodyContainer);
		}

		// Update title
		this.updateTitle("0 cards");

		new Notice(`${unburiedCount} card${unburiedCount > 1 ? "s" : ""} unburied`);
	}

	private async handleDeleteAll(): Promise<void> {
		// Confirm with user
		const confirmed = confirm(`Delete all ${this.options.cards.length} suspended cards? This action cannot be undone.`);
		if (!confirmed) return;

		let deletedCount = 0;
		const cards = [...this.options.cards];

		for (const card of cards) {
			const success = await this.flashcardManager.removeFlashcardById(card.id);
			if (success) {
				deletedCount++;
			}
		}

		// Clear all cards from list
		this.options.cards = [];

		// Re-render
		if (this.bodyContainer) {
			this.renderBody(this.bodyContainer);
		}

		// Update title
		this.updateTitle("0 cards");

		new Notice(`${deletedCount} card${deletedCount !== 1 ? "s" : ""} deleted`);
	}
}
