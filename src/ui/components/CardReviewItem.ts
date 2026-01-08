/**
 * Card Review Item Component
 * Displays a single flashcard with question/answer fields and delete/open buttons
 * Matches the FlashcardReviewModal design
 */
import type { App, Component } from "obsidian";
import { MarkdownRenderer, Notice } from "obsidian";
import type { FlashcardItem, FSRSFlashcardItem } from "../../types";
import { BaseComponent } from "../component.base";

// Union type for card data
export type CardData = FlashcardItem | FSRSFlashcardItem;

// Edit mode state
interface EditMode {
	field: "question" | "answer";
	isEditing: boolean;
}

export interface CardReviewItemProps {
	// Card data - supports both FlashcardItem and FSRSFlashcardItem
	card: CardData;
	// File path for markdown rendering context
	filePath: string;
	// Obsidian app and component for markdown rendering
	app: App;
	component: Component;
	// Optional handlers
	onClick?: (card: CardData) => void; // For edit (opens file - normal click)
	onDelete?: (card: CardData) => void;
	onOpen?: (card: CardData) => void; // Open source note
	onCopy?: (card: CardData) => void; // Copy flashcard
	onMove?: (card: CardData) => void; // Move flashcard
	onUnbury?: (card: CardData) => void; // Unbury card
	onEditSave?: (card: CardData, field: "question" | "answer", newContent: string) => Promise<void>; // In-place edit save
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
	// Edit mode state
	private editMode: EditMode | null = null;

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

		// Check if we're in edit mode
		if (this.editMode?.isEditing) {
			this.renderEditMode();
		} else {
			// Make clickable if onClick provided
			if (onClick) {
				this.events.addEventListener(this.element, "click", () => {
					onClick(card);
				});
			}

			// Content wrapper (takes remaining space)
			const contentEl = this.element.createDiv({ cls: "episteme-review-card-content" });

			// Question field
			this.renderField(contentEl, "question", card.question, filePath, app, component);

			// Answer field
			this.renderField(contentEl, "answer", card.answer, filePath, app, component);

			// Buttons container (right side)
			this.renderButtons();

			// Setup internal link handler
			this.setupInternalLinkHandler();
		}
	}

	private renderField(
		container: HTMLElement,
		field: "question" | "answer",
		content: string,
		filePath: string,
		app: App,
		component: Component
	): void {
		const fieldEl = container.createDiv({
			cls: "episteme-review-field episteme-review-field--view",
		});
		fieldEl.createDiv({ cls: "episteme-review-field-label", text: `${field === "question" ? "Question" : "Answer"}:` });
		const fieldContent = fieldEl.createDiv({ cls: "episteme-md-content" });

		if (field === "question") {
			this.questionContentEl = fieldContent;
		} else {
			this.answerContentEl = fieldContent;
		}

		void MarkdownRenderer.render(app, content, fieldContent, filePath, component);

		// Add click handler for field
		this.events.addEventListener(fieldEl, "click", (e) => this.handleFieldClick(e, field));
	}

	private handleFieldClick(e: MouseEvent, field: "question" | "answer"): void {
		// Cmd/Ctrl+click = edit mode
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();
			e.stopPropagation();
			this.startEdit(field);
			return;
		}

		// Check if clicked on internal link
		const linkEl = (e.target as HTMLElement).closest("a.internal-link");
		if (!linkEl) {
			// Normal click on field (not on link) - let the card's click handler deal with it
			// We don't call onClick here to avoid double-triggering
		}
	}

	private startEdit(field: "question" | "answer"): void {
		if (!this.props.onEditSave) return;
		this.editMode = { field, isEditing: true };
		this.render();
	}

	private renderEditMode(): void {
		const { card } = this.props;
		if (!this.editMode || !this.element) return;

		const { field } = this.editMode;
		const content = field === "question" ? card.question : card.answer;
		const label = field === "question" ? "Question:" : "Answer:";

		// Label for the field being edited
		const labelEl = this.element.createDiv({
			cls: "episteme-review-field-label",
			text: label,
		});

		// Editable contenteditable div - show raw markdown
		const editEl = this.element.createDiv({
			cls: "episteme-review-editable",
			attr: {
				contenteditable: "true",
				"data-field": field,
			},
		});

		// Set raw markdown as text content (not rendered)
		editEl.textContent = content;

		// Focus after delay
		setTimeout(() => {
			editEl.focus();
			// Move cursor to end
			const range = document.createRange();
			const sel = window.getSelection();
			if (sel && editEl.childNodes.length > 0) {
				range.selectNodeContents(editEl);
				range.collapse(false);
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}, 10);

		// Event listeners
		this.events.addEventListener(editEl, "blur", () => void this.saveEdit(field));
		this.events.addEventListener(editEl, "keydown", (e) => this.handleEditKeydown(e, field));
	}

	private async saveEdit(field: "question" | "answer"): Promise<void> {
		if (!this.element || !this.props.card) return;

		const editEl = this.element.querySelector(
			`.episteme-review-editable[data-field="${field}"]`
		) as HTMLElement;

		if (!editEl) return;

		// Convert HTML to markdown
		const content = this.convertEditableToMarkdown(editEl);

		// Call save handler
		try {
			await this.props.onEditSave?.(this.props.card, field, content);
		} catch (error) {
			new Notice(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}

		// Exit edit mode
		this.editMode = null;
		this.render();
	}

	private handleEditKeydown(e: KeyboardEvent, field: "question" | "answer"): void {
		if (e.key === "Escape") {
			e.preventDefault();
			void this.saveEdit(field);
		} else if (e.key === "Tab") {
			e.preventDefault();
			const nextField = field === "question" ? "answer" : "question";
			void this.saveEdit(field).then(() => {
				this.startEdit(nextField);
			});
		}
	}

	private convertEditableToMarkdown(editEl: HTMLElement): string {
		let html = editEl.innerHTML;

		// Replace <br> tags with newline
		html = html.replace(/<br\s*\/?>/gi, "\n");

		// Replace closing </div> and </p> with newline (opening tags create blocks)
		html = html.replace(/<\/div>/gi, "\n");
		html = html.replace(/<\/p>/gi, "\n");

		// Remove remaining HTML tags
		html = html.replace(/<[^>]*>/g, "");

		// Decode HTML entities
		const textarea = document.createElement("textarea");
		textarea.innerHTML = html;
		const text = textarea.value;

		// Trim trailing newlines but preserve internal ones
		const trimmed = text.replace(/\n+$/, "");

		// Convert newlines back to <br> for flashcard format
		return trimmed.replace(/\n/g, "<br>");
	}

	private renderButtons(): void {
		const { card, onDelete, onOpen, onCopy, onMove, onUnbury } = this.props;
		if (!this.element) return;
		const buttonsEl = this.element.createDiv({ cls: "episteme-review-card-buttons" });

		// Unbury button (shows first if available)
		if (onUnbury) {
			const unburyBtn = buttonsEl.createEl("button", {
				cls: "episteme-review-unbury-btn",
				attr: { "aria-label": "Unbury card", "title": "Unbury" },
			});
			// Eye icon (opposite of eye-off used for bury)
			unburyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
			this.events.addEventListener(unburyBtn, "click", (e) => {
				e.stopPropagation();
				onUnbury(card);
			});
		}

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

		// Copy button
		if (onCopy) {
			const copyBtn = buttonsEl.createEl("button", {
				cls: "episteme-review-copy-btn",
				attr: { "aria-label": "Copy flashcard", "title": "Copy" },
			});
			copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
			this.events.addEventListener(copyBtn, "click", (e) => {
				e.stopPropagation();
				onCopy(card);
			});
		}

		// Move button
		if (onMove) {
			const moveBtn = buttonsEl.createEl("button", {
				cls: "episteme-review-move-btn",
				attr: { "aria-label": "Move flashcard", "title": "Move" },
			});
			moveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
			this.events.addEventListener(moveBtn, "click", (e) => {
				e.stopPropagation();
				onMove(card);
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
