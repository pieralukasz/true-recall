/**
 * Card Review Item Component
 * Displays a single flashcard with question/answer fields and delete/open buttons
 * Matches the FlashcardReviewModal design
 */
import type { App, Component } from "obsidian";
import { MarkdownRenderer } from "obsidian";
import type { FlashcardItem, FSRSFlashcardItem } from "../../types";
import { BaseComponent } from "../component.base";

// Union type for card data
export type CardData = FlashcardItem | FSRSFlashcardItem;

export interface CardReviewItemProps {
	// Card data - supports both FlashcardItem and FSRSFlashcardItem
	card: CardData;
	// File path for markdown rendering context
	filePath: string;
	// Obsidian app and component for markdown rendering
	app: App;
	component: Component;
	// Optional handlers
	onClick?: (card: CardData) => void; // For edit
	onDelete?: (card: CardData) => void;
	onOpen?: (card: CardData) => void; // Open source note
}

/**
 * Card review item component for displaying a single flashcard
 * with question/answer fields and delete/open buttons
 */
export class CardReviewItem extends BaseComponent {
	private props: CardReviewItemProps;
	// Store references to markdown content elements for internal link handling
	private questionContentEl: HTMLElement | null = null;
	private answerContentEl: HTMLElement | null = null;

	constructor(container: HTMLElement, props: CardReviewItemProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Clear existing element if any
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { card, filePath, app, component, onClick } = this.props;

		// Create container
		this.element = this.container.createDiv({
			cls: "episteme-review-card-item",
		});

		// Make clickable if onClick provided
		if (onClick) {
			this.events.addEventListener(this.element, "click", () => {
				onClick(card);
			});
		}

		// Content wrapper (takes remaining space)
		const contentEl = this.element.createDiv({ cls: "episteme-review-card-content" });

		// Question field
		const questionEl = contentEl.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
		});
		questionEl.createDiv({ cls: "episteme-review-field-label", text: "Question:" });
		const questionContent = questionEl.createDiv({ cls: "episteme-md-content" });
		this.questionContentEl = questionContent;
		void MarkdownRenderer.render(app, card.question, questionContent, filePath, component);

		// Answer field
		const answerEl = contentEl.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
		});
		answerEl.createDiv({ cls: "episteme-review-field-label", text: "Answer:" });
		const answerContent = answerEl.createDiv({ cls: "episteme-md-content" });
		this.answerContentEl = answerContent;
		void MarkdownRenderer.render(app, card.answer, answerContent, filePath, component);

		// Buttons container (right side)
		this.renderButtons();

		// Setup internal link handler
		this.setupInternalLinkHandler();
	}

	private renderButtons(): void {
		const { card, onDelete, onOpen } = this.props;
		if (!this.element) return;
		const buttonsEl = this.element.createDiv({ cls: "episteme-review-card-buttons" });

		// Delete button
		if (onDelete) {
			const deleteBtn = buttonsEl.createEl("button", {
				cls: "episteme-review-delete-btn",
				attr: { "aria-label": "Delete flashcard", "title": "Delete" },
			});
			deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
			this.events.addEventListener(deleteBtn, "click", (e) => {
				e.stopPropagation();
				onDelete(card);
			});
		}

		// Open button
		if (onOpen) {
			const openBtn = buttonsEl.createEl("button", {
				cls: "episteme-review-open-btn",
				attr: { "aria-label": "Open source note", "title": "Open" },
			});
			openBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
			this.events.addEventListener(openBtn, "click", (e) => {
				e.stopPropagation();
				onOpen(card);
			});
		}
	}

	/**
	 * Setup click handler for internal links (wiki links)
	 * Uses capture phase to intercept before Obsidian's handlers
	 */
	private setupInternalLinkHandler(): void {
		const { filePath, app } = this.props;
		const contentElements = [this.questionContentEl, this.answerContentEl].filter(Boolean);

		contentElements.forEach((el) => {
			el?.addEventListener(
				"click",
				(e: MouseEvent) => {
					const linkEl = (e.target as HTMLElement).closest("a.internal-link");
					if (!linkEl) return;

					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();

					const href = linkEl.getAttribute("data-href");
					if (!href) return;

					// Open link in existing tab if available
					void app.workspace.openLinkText(href, filePath, false);
				},
				true
			); // capture: true
		});
	}

	/**
	 * Update the card data and re-render
	 */
	updateCard(card: CardData): void {
		this.props.card = card;
		this.render();
	}
}

/**
 * Create a card review item component
 */
export function createCardReviewItem(
	container: HTMLElement,
	props: CardReviewItemProps
): CardReviewItem {
	const item = new CardReviewItem(container, props);
	item.render();
	return item;
}
