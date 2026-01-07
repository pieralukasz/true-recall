/**
 * Card Preview Modal
 * Displays a list of flashcards with preview and navigation to source note
 */
import { App, Component, MarkdownRenderer, Notice, TFile } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";
import { formatIntervalDays } from "../../types";
import { BaseModal } from "./BaseModal";
import type { FlashcardManager } from "../../services";

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
			this.renderCard(listEl, card);
		}

		// Setup internal link handler for wiki links
		this.setupInternalLinkHandler();
	}

	onClose(): void {
		this.component.unload();
		const { contentEl } = this;
		contentEl.empty();
	}

	private renderCard(container: HTMLElement, card: FSRSFlashcardItem): void {
		const itemEl = container.createDiv({
			cls: "episteme-review-card-item",
		});

		// Content wrapper (takes remaining space)
		const contentEl = itemEl.createDiv({ cls: "episteme-review-card-content" });

		// Question field
		const questionEl = contentEl.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
		});
		questionEl.createDiv({ cls: "episteme-review-field-label", text: "Question:" });
		const questionContent = questionEl.createDiv({ cls: "episteme-md-content" });
		void MarkdownRenderer.render(
			this.app,
			card.question,
			questionContent,
			card.filePath,
			this.component
		);

		// Answer field
		const answerEl = contentEl.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
		});
		answerEl.createDiv({ cls: "episteme-review-field-label", text: "Answer:" });
		const answerContent = answerEl.createDiv({ cls: "episteme-md-content" });
		void MarkdownRenderer.render(
			this.app,
			card.answer,
			answerContent,
			card.filePath,
			this.component
		);

		// Buttons container (right side)
		const buttonsEl = itemEl.createDiv({ cls: "episteme-review-card-buttons" });

		// Delete button
		const deleteBtn = buttonsEl.createEl("button", {
			cls: "episteme-review-delete-btn",
			attr: { "aria-label": "Delete flashcard", "title": "Delete" },
		});
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
		deleteBtn.addEventListener("click", () => void this.handleDeleteCard(card));

		// Open button
		const openBtn = buttonsEl.createEl("button", {
			cls: "episteme-review-open-btn",
			attr: { "aria-label": "Open source note", "title": "Open" },
		});
		openBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
		openBtn.addEventListener("click", () => void this.openSourceNote(card));
	}

	private async handleDeleteCard(card: FSRSFlashcardItem): Promise<void> {
		const confirmed = confirm("Delete this flashcard? This action cannot be undone.");
		if (!confirmed) return;

		const file = this.app.vault.getAbstractFileByPath(card.filePath);
		if (!(file instanceof TFile)) {
			new Notice("Could not find flashcard file");
			return;
		}

		const success = await this.flashcardManager.removeFlashcardDirect(file, card.lineNumber);

		if (success) {
			new Notice("Flashcard deleted");
			// Remove card from list
			this.options.cards = this.options.cards.filter(c => c.id !== card.id);
			// Re-render
			this.renderBody(this.contentEl);
			// Update title
			this.updateTitle(`${this.options.cards.length} cards`);
		} else {
			new Notice("Failed to delete flashcard");
		}
	}

	private async openSourceNote(card: FSRSFlashcardItem): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);

		// Try to open the original source note if available
		if (card.sourceNoteName) {
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
		const file = this.app.vault.getAbstractFileByPath(card.filePath);
		if (file && file instanceof TFile) {
			await leaf.openFile(file, {
				eState: { line: card.lineNumber },
			});
			this.close();
		}
	}

	/**
	 * Setup click handler for internal links (wiki links)
	 * Uses capture phase to intercept before Obsidian's handlers
	 */
	private setupInternalLinkHandler(): void {
		const { contentEl } = this;

		contentEl.addEventListener(
			"click",
			(e: MouseEvent) => {
				const linkEl = (e.target as HTMLElement).closest("a.internal-link");
				if (!linkEl) return;

				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();

				const href = linkEl.getAttribute("data-href");
				if (!href) return;

				// Open link in existing tab
				void this.app.workspace.openLinkText(href, "", false);
			},
			true
		); // capture: true
	}
}
