/**
 * Card Review Item Component
 * Displays a single flashcard with question/answer fields and delete/open buttons
 * Matches the FlashcardReviewModal design
 */
import type { App, Component } from "obsidian";
import { MarkdownRenderer } from "obsidian";
import type { FlashcardItem, FSRSFlashcardItem } from "../../types";
import { notify } from "../../services";
import { BaseComponent } from "../component.base";
import {
	createEditableTextField,
	EditableTextField,
	TOOLBAR_BUTTONS,
} from "./EditableTextField";

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
	onEditButton?: (card: CardData) => void; // Edit button opens modal
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
	// Editable text field instance
	private editableField: EditableTextField | null = null;

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
			cls: "ep:flex ep:flex-col ep:gap-3 ep:mb-3 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border ep:hover:border-obs-interactive",
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
			const contentEl = this.element.createDiv({ cls: "ep:flex-1 ep:min-w-0" });

			// Question field
			this.renderField(contentEl, "question", card.question, filePath, app, component);

			// Divider between question and answer
			contentEl.createEl("hr", { cls: "ep:border-none ep:border-t ep:border-obs-border ep:my-0" });

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
			cls: "ep:relative ep:cursor-pointer ep:px-2 ep:py-1 ep:rounded ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});

		const fieldContent = fieldEl.createDiv({ cls: "ep:inline" });

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
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;
	const linkEl = target.closest("a.internal-link");
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

		// Use EditableTextField component with toolbar
		this.editableField = createEditableTextField(this.element, {
			initialValue: content,
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.UNIFIED,
			toolbarPositioned: false, // Don't use absolute positioning here
			field,
			autoFocus: true,
			onSave: (value) => void this.saveEdit(field, value),
			onTab: () => {
				const nextField = field === "question" ? "answer" : "question";
				void (async () => {
					if (this.editableField) {
						await this.saveEdit(field, this.editableField.getValue());
					}
					this.startEdit(nextField);
				})();
			},
		});
	}

	private async saveEdit(field: "question" | "answer", content: string): Promise<void> {
		if (!this.props.card) return;

		// Call save handler
		try {
			await this.props.onEditSave?.(this.props.card, field, content);
		} catch (error) {
			notify().operationFailed("save", error);
			return;
		}

		// Cleanup editable field
		this.editableField?.destroy();
		this.editableField = null;

		// Exit edit mode
		this.editMode = null;
		this.render();
	}

	private renderButtons(): void {
		const { card, onDelete, onOpen, onCopy, onMove, onUnbury, onEditButton } = this.props;
		if (!this.element) return;
		const buttonsEl = this.element.createDiv({ cls: "ep:flex ep:flex-row ep:gap-2 ep:shrink-0 ep:self-end" });

		// Shared button styles
		const btnCls = "ep:p-1.5 ep:rounded ep:bg-transparent ep:border-none ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors";

		// Unbury button (shows first if available)
		if (onUnbury) {
			const unburyBtn = buttonsEl.createEl("button", {
				cls: btnCls,
				attr: { "aria-label": "Unbury card", "title": "Unbury" },
			});
			// Eye icon (opposite of eye-off used for bury)
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("fill", "none");
			svg.setAttribute("stroke", "currentColor");
			svg.setAttribute("stroke-width", "2");
			svg.setAttribute("stroke-linecap", "round");
			svg.setAttribute("stroke-linejoin", "round");
			const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path1.setAttribute("d", "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z");
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			circle.setAttribute("cx", "12");
			circle.setAttribute("cy", "12");
			circle.setAttribute("r", "3");
			svg.appendChild(path1);
			svg.appendChild(circle);
			unburyBtn.appendChild(svg);
			this.events.addEventListener(unburyBtn, "click", (e) => {
				e.stopPropagation();
				onUnbury(card);
			});
		}

		// Edit button
		if (onEditButton) {
			const editBtn = buttonsEl.createEl("button", {
				cls: btnCls,
				attr: { "aria-label": "Edit flashcard", "title": "Edit" },
			});
			const editSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			editSvg.setAttribute("width", "16");
			editSvg.setAttribute("height", "16");
			editSvg.setAttribute("viewBox", "0 0 24 24");
			editSvg.setAttribute("fill", "none");
			editSvg.setAttribute("stroke", "currentColor");
			editSvg.setAttribute("stroke-width", "2");
			editSvg.setAttribute("stroke-linecap", "round");
			editSvg.setAttribute("stroke-linejoin", "round");
			const editPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
			editPath1.setAttribute("d", "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7");
			const editPath2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
			editPath2.setAttribute("d", "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z");
			editSvg.appendChild(editPath1);
			editSvg.appendChild(editPath2);
			editBtn.appendChild(editSvg);
			this.events.addEventListener(editBtn, "click", (e) => {
				e.stopPropagation();
				onEditButton(card);
			});
		}

		// Delete button
		if (onDelete) {
			const deleteBtn = buttonsEl.createEl("button", {
				cls: btnCls,
				attr: { "aria-label": "Delete flashcard", "title": "Delete" },
			});
			const deleteSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			deleteSvg.setAttribute("width", "16");
			deleteSvg.setAttribute("height", "16");
			deleteSvg.setAttribute("viewBox", "0 0 24 24");
			deleteSvg.setAttribute("fill", "none");
			deleteSvg.setAttribute("stroke", "currentColor");
			deleteSvg.setAttribute("stroke-width", "2");
			deleteSvg.setAttribute("stroke-linecap", "round");
			deleteSvg.setAttribute("stroke-linejoin", "round");
			const deletePath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
			deletePath1.setAttribute("d", "M3 6h18");
			const deletePath2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
			deletePath2.setAttribute("d", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6");
			const deletePath3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
			deletePath3.setAttribute("d", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2");
			deleteSvg.appendChild(deletePath1);
			deleteSvg.appendChild(deletePath2);
			deleteSvg.appendChild(deletePath3);
			deleteBtn.appendChild(deleteSvg);
			this.events.addEventListener(deleteBtn, "click", (e) => {
				e.stopPropagation();
				onDelete(card);
			});
		}

		// Open button
		if (onOpen) {
			const openBtn = buttonsEl.createEl("button", {
				cls: btnCls,
				attr: { "aria-label": "Open source note", "title": "Open" },
			});
			const openSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			openSvg.setAttribute("width", "16");
			openSvg.setAttribute("height", "16");
			openSvg.setAttribute("viewBox", "0 0 24 24");
			openSvg.setAttribute("fill", "none");
			openSvg.setAttribute("stroke", "currentColor");
			openSvg.setAttribute("stroke-width", "2");
			openSvg.setAttribute("stroke-linecap", "round");
			openSvg.setAttribute("stroke-linejoin", "round");
			const openPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			openPath.setAttribute("d", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");
			const openPolyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
			openPolyline.setAttribute("points", "15 3 21 3 21 9");
			const openLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
			openLine.setAttribute("x1", "10");
			openLine.setAttribute("y1", "14");
			openLine.setAttribute("x2", "21");
			openLine.setAttribute("y2", "3");
			openSvg.appendChild(openPath);
			openSvg.appendChild(openPolyline);
			openSvg.appendChild(openLine);
			openBtn.appendChild(openSvg);
			this.events.addEventListener(openBtn, "click", (e) => {
				e.stopPropagation();
				onOpen(card);
			});
		}

		// Copy button
		if (onCopy) {
			const copyBtn = buttonsEl.createEl("button", {
				cls: btnCls,
				attr: { "aria-label": "Copy flashcard", "title": "Copy" },
			});
			const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			copySvg.setAttribute("width", "16");
			copySvg.setAttribute("height", "16");
			copySvg.setAttribute("viewBox", "0 0 24 24");
			copySvg.setAttribute("fill", "none");
			copySvg.setAttribute("stroke", "currentColor");
			copySvg.setAttribute("stroke-width", "2");
			copySvg.setAttribute("stroke-linecap", "round");
			copySvg.setAttribute("stroke-linejoin", "round");
			const copyRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			copyRect.setAttribute("x", "9");
			copyRect.setAttribute("y", "9");
			copyRect.setAttribute("width", "13");
			copyRect.setAttribute("height", "13");
			copyRect.setAttribute("rx", "2");
			copyRect.setAttribute("ry", "2");
			const copyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			copyPath.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
			copySvg.appendChild(copyRect);
			copySvg.appendChild(copyPath);
			copyBtn.appendChild(copySvg);
			this.events.addEventListener(copyBtn, "click", (e) => {
				e.stopPropagation();
				onCopy(card);
			});
		}

		// Move button
		if (onMove) {
			const moveBtn = buttonsEl.createEl("button", {
				cls: btnCls,
				attr: { "aria-label": "Move flashcard", "title": "Move" },
			});
			const moveSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			moveSvg.setAttribute("width", "16");
			moveSvg.setAttribute("height", "16");
			moveSvg.setAttribute("viewBox", "0 0 24 24");
			moveSvg.setAttribute("fill", "none");
			moveSvg.setAttribute("stroke", "currentColor");
			moveSvg.setAttribute("stroke-width", "2");
			moveSvg.setAttribute("stroke-linecap", "round");
			moveSvg.setAttribute("stroke-linejoin", "round");
			const movePoly1 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
			movePoly1.setAttribute("points", "5 9 2 12 5 15");
			const movePoly2 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
			movePoly2.setAttribute("points", "9 5 12 2 15 5");
			const movePoly3 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
			movePoly3.setAttribute("points", "15 19 12 22 9 19");
			const movePoly4 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
			movePoly4.setAttribute("points", "19 9 22 12 19 15");
			const moveLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
			moveLine.setAttribute("x1", "2");
			moveLine.setAttribute("y1", "12");
			moveLine.setAttribute("x2", "22");
			moveLine.setAttribute("y2", "12");
			moveSvg.appendChild(movePoly1);
			moveSvg.appendChild(movePoly2);
			moveSvg.appendChild(movePoly3);
			moveSvg.appendChild(movePoly4);
			moveSvg.appendChild(moveLine);
			moveBtn.appendChild(moveSvg);
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
					const target = e.target;
					if (!(target instanceof HTMLElement)) return;
					const linkEl = target.closest("a.internal-link");
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
