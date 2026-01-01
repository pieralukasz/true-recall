/**
 * Card Preview Component
 * Displays a single flashcard with question and answer
 */
import type { App, Component, MarkdownRenderer } from "obsidian";
import type { FlashcardItem } from "../../types";
import { BaseComponent } from "../component.base";

export interface CardPreviewHandlers {
	app: App;
	component: Component;
	onEdit?: (card: FlashcardItem) => void;
	onCopy?: (card: FlashcardItem) => void;
	onDelete?: (card: FlashcardItem) => void;
}

export interface CardPreviewProps {
	flashcard: FlashcardItem;
	filePath: string;
	handlers: CardPreviewHandlers;
	showActions?: boolean;
	markdownRenderer: typeof MarkdownRenderer;
}

/**
 * Card preview component for displaying a single flashcard
 */
export class CardPreview extends BaseComponent {
	private props: CardPreviewProps;

	constructor(container: HTMLElement, props: CardPreviewProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Clear existing element if any
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { flashcard, handlers, showActions = true } = this.props;

		this.element = this.container.createDiv({
			cls: "shadow-anki-card clickable",
		});
		this.element.style.cursor = "pointer";

		// Click on card to edit
		if (handlers.onEdit) {
			this.events.addEventListener(this.element, "click", () => {
				handlers.onEdit?.(flashcard);
			});
		}

		// Card header with actions
		const cardHeader = this.element.createDiv({
			cls: "shadow-anki-card-header",
		});

		// Question section
		this.renderQuestion(cardHeader);

		// Action buttons
		if (showActions) {
			this.renderActions(cardHeader);
		}

		// Answer section
		this.renderAnswer();
	}

	private renderQuestion(header: HTMLElement): void {
		const { flashcard, filePath, handlers, markdownRenderer } = this.props;

		const questionEl = header.createDiv({
			cls: "shadow-anki-card-question",
		});
		questionEl.createSpan({
			text: "Q: ",
			cls: "shadow-anki-card-label",
		});
		const questionContent = questionEl.createDiv({
			cls: "shadow-anki-md-content",
		});

		// Render markdown
		void markdownRenderer.render(
			handlers.app,
			flashcard.question,
			questionContent,
			filePath,
			handlers.component
		);
	}

	private renderAnswer(): void {
		const { flashcard, filePath, handlers, markdownRenderer } = this.props;

		if (!this.element) return;

		const answerEl = this.element.createDiv({
			cls: "shadow-anki-card-answer",
		});
		answerEl.createSpan({
			text: "A: ",
			cls: "shadow-anki-card-label",
		});
		const answerContent = answerEl.createDiv({
			cls: "shadow-anki-md-content",
		});

		// Render markdown
		void markdownRenderer.render(
			handlers.app,
			flashcard.answer,
			answerContent,
			filePath,
			handlers.component
		);
	}

	private renderActions(header: HTMLElement): void {
		const { flashcard, handlers } = this.props;

		const actionsEl = header.createDiv({
			cls: "shadow-anki-card-actions",
		});

		// Copy button
		if (handlers.onCopy) {
			const copyBtn = actionsEl.createSpan({
				cls: "shadow-anki-card-btn clickable-icon",
				attr: { "aria-label": "Copy flashcard" },
			});
			copyBtn.textContent = "\u{1F4CB}"; // clipboard emoji
			this.events.addEventListener(copyBtn, "click", (e) => {
				e.stopPropagation();
				handlers.onCopy?.(flashcard);
			});
		}

		// Delete button
		if (handlers.onDelete) {
			const removeBtn = actionsEl.createSpan({
				cls: "shadow-anki-card-btn clickable-icon",
				attr: { "aria-label": "Remove flashcard" },
			});
			removeBtn.textContent = "\u{1F5D1}"; // trash emoji
			this.events.addEventListener(removeBtn, "click", (e) => {
				e.stopPropagation();
				handlers.onDelete?.(flashcard);
			});
		}
	}

	/**
	 * Update the flashcard data and re-render
	 */
	updateCard(flashcard: FlashcardItem): void {
		this.props.flashcard = flashcard;
		this.render();
	}
}

/**
 * Create a card preview component
 */
export function createCardPreview(
	container: HTMLElement,
	props: CardPreviewProps
): CardPreview {
	const card = new CardPreview(container, props);
	card.render();
	return card;
}
