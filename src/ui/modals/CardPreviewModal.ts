/**
 * Card Preview Modal
 * Displays a list of flashcards with preview and navigation to source note
 */
import { App, Modal, TFile } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";
import { formatIntervalDays } from "../../types";

export interface CardPreviewModalOptions {
	title: string;
	cards: FSRSFlashcardItem[];
}

/**
 * Modal for previewing a list of flashcards
 */
export class CardPreviewModal extends Modal {
	private options: CardPreviewModalOptions;

	constructor(app: App, options: CardPreviewModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("episteme-card-preview-modal");

		// Title
		contentEl.createEl("h2", { text: this.options.title });

		// Cards count
		const countEl = contentEl.createDiv({ cls: "episteme-card-preview-count" });
		countEl.setText(`${this.options.cards.length} cards`);

		// Cards list
		const listEl = contentEl.createDiv({ cls: "episteme-card-preview-list" });

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
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private renderCard(container: HTMLElement, card: FSRSFlashcardItem): void {
		const item = container.createDiv({ cls: "episteme-card-preview-item" });

		// Question (truncated)
		const questionEl = item.createDiv({ cls: "episteme-card-preview-question" });
		questionEl.setText(this.truncateText(this.stripMarkdown(card.question), 120));

		// Answer (truncated)
		const answerEl = item.createDiv({ cls: "episteme-card-preview-answer" });
		answerEl.setText(this.truncateText(this.stripMarkdown(card.answer), 200));

		// Card info row (interval, stability)
		const infoEl = item.createDiv({ cls: "episteme-card-preview-info" });
		if (card.fsrs.scheduledDays > 0) {
			infoEl.createSpan({
				cls: "episteme-card-preview-interval",
				text: `Interval: ${formatIntervalDays(card.fsrs.scheduledDays)}`,
			});
		}
		if (card.fsrs.stability > 0) {
			infoEl.createSpan({
				cls: "episteme-card-preview-stability",
				text: `Stability: ${formatIntervalDays(card.fsrs.stability)}`,
			});
		}

		// Footer with source and open button
		const footer = item.createDiv({ cls: "episteme-card-preview-footer" });

		// Source note link - use sourceNoteName if available, otherwise fall back to flashcard file name
		const noteName = card.sourceNoteName ?? this.getNoteName(card.filePath);
		const sourceEl = footer.createEl("a", {
			cls: "episteme-card-preview-source",
			text: noteName,
		});
		sourceEl.addEventListener("click", (e) => {
			e.preventDefault();
			void this.openSourceNote(card);
		});

		// Open button
		const openBtn = footer.createEl("button", {
			cls: "episteme-card-preview-open-btn",
			text: "Open",
		});
		openBtn.addEventListener("click", () => {
			void this.openSourceNote(card);
		});
	}

	private getNoteName(filePath: string): string {
		const parts = filePath.split("/");
		const fileName = parts[parts.length - 1] ?? filePath;
		return fileName.replace(".md", "");
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

	private truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength - 3) + "...";
	}

	private stripMarkdown(text: string): string {
		return (
			text
				// Remove wiki links [[link]] or [[link|display]]
				.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_: string, link: string, display: string) => display || link)
				// Remove markdown links [text](url)
				.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
				// Remove bold/italic
				.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
				// Remove code blocks
				.replace(/`{1,3}[^`]+`{1,3}/g, "")
				// Remove headers
				.replace(/^#{1,6}\s+/gm, "")
				// Remove line breaks
				.replace(/\n/g, " ")
				// Normalize whitespace
				.replace(/\s+/g, " ")
				.trim()
		);
	}
}
