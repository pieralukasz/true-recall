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
	onMove?: (card: FlashcardItem) => void;
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
	// Store references to markdown content elements for internal link handling
	private questionContentEl: HTMLElement | null = null;
	private answerContentEl: HTMLElement | null = null;

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
			cls: "ep:py-2 ep:bg-obs-secondary ep:rounded-md ep:mb-1.5 ep:cursor-pointer clickable",
		});

		// Click on card to edit
		if (handlers.onEdit) {
			this.events.addEventListener(this.element, "click", () => {
				handlers.onEdit?.(flashcard);
			});
		}

		// Card header with actions
		const cardHeader = this.element.createDiv({
			cls: "ep:flex ep:justify-between ep:items-start ep:gap-2",
		});

		// Question section
		this.renderQuestion(cardHeader);

		// Action buttons
		if (showActions) {
			this.renderActions(cardHeader);
		}

		// Answer section
		this.renderAnswer();

		// Setup internal link handler
		this.setupInternalLinkHandler();
	}

	private renderQuestion(header: HTMLElement): void {
		const { flashcard, filePath, handlers, markdownRenderer } = this.props;

		const questionEl = header.createDiv({
			cls: "ep:text-ui-small ep:leading-normal ep:text-obs-normal ep:flex-1 ep:mb-1.5",
		});
		questionEl.createSpan({
			text: "Q: ",
			cls: "ep:font-semibold ep:text-obs-muted",
		});
		const questionContent = questionEl.createDiv({
			cls: "ep:inline",
		});

		// Store reference for internal link handler
		this.questionContentEl = questionContent;

		// Render markdown (strip <br> tags for cleaner display)
		void markdownRenderer.render(
			handlers.app,
			this.stripBrTags(flashcard.question),
			questionContent,
			filePath,
			handlers.component
		);
	}

	private renderAnswer(): void {
		const { flashcard, filePath, handlers, markdownRenderer } = this.props;

		if (!this.element) return;

		const answerEl = this.element.createDiv({
			cls: "ep:text-ui-small ep:leading-normal ep:text-obs-normal ep:flex-1",
		});
		answerEl.createSpan({
			text: "A: ",
			cls: "ep:font-semibold ep:text-obs-muted",
		});
		const answerContent = answerEl.createDiv({
			cls: "ep:inline",
		});

		// Store reference for internal link handler
		this.answerContentEl = answerContent;

		// Render markdown (strip <br> tags for cleaner display)
		void markdownRenderer.render(
			handlers.app,
			this.stripBrTags(flashcard.answer),
			answerContent,
			filePath,
			handlers.component
		);
	}

	/**
	 * Remove <br> tags from text for cleaner display
	 * Replaces <br>, <br/>, <br /> with newlines
	 */
	private stripBrTags(text: string): string {
		return text.replace(/<br\s*\/?>/gi, "\n");
	}

	private renderActions(header: HTMLElement): void {
		const { flashcard, handlers } = this.props;

		const actionsEl = header.createDiv({
			cls: "ep:flex ep:gap-2 ep:shrink-0",
		});

		// Button classes
		const btnCls = "ep:cursor-pointer ep:opacity-60 ep:text-ui-smaller ep:px-1 ep:py-0.5 ep:rounded ep:hover:opacity-100 ep:hover:bg-obs-modifier-hover clickable-icon";

		// Copy button
		if (handlers.onCopy) {
			const copyBtn = actionsEl.createEl("button", {
				cls: btnCls,
				attr: {
					"aria-label": "Copy flashcard",
					"data-tooltip-position": "top",
				},
			});
			copyBtn.textContent = "\u{1F4CB}"; // clipboard emoji
			this.events.addEventListener(copyBtn, "click", (e) => {
				e.stopPropagation();
				handlers.onCopy?.(flashcard);
			});
			this.events.addEventListener(copyBtn, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					handlers.onCopy?.(flashcard);
				}
			});
		}

		// Move button
		if (handlers.onMove) {
			const moveBtn = actionsEl.createEl("button", {
				cls: btnCls,
				attr: {
					"aria-label": "Move flashcard to another note",
					"data-tooltip-position": "top",
				},
			});
			moveBtn.textContent = "\u{1F4E4}"; // outbox emoji (📤)
			this.events.addEventListener(moveBtn, "click", (e) => {
				e.stopPropagation();
				handlers.onMove?.(flashcard);
			});
			this.events.addEventListener(moveBtn, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					handlers.onMove?.(flashcard);
				}
			});
		}

		// Delete button
		if (handlers.onDelete) {
			const removeBtn = actionsEl.createEl("button", {
				cls: btnCls,
				attr: {
					"aria-label": "Remove flashcard",
					"data-tooltip-position": "top",
				},
			});
			removeBtn.textContent = "\u{1F5D1}"; // trash emoji
			this.events.addEventListener(removeBtn, "click", (e) => {
				e.stopPropagation();
				handlers.onDelete?.(flashcard);
			});
			this.events.addEventListener(removeBtn, "keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					handlers.onDelete?.(flashcard);
				}
			});
		}
	}

	/**
	 * Setup click handler for internal links
	 * Uses capture phase to intercept before Obsidian's handlers
	 * Now attached only to markdown content elements to avoid interfering with card clicks
	 */
	private setupInternalLinkHandler(): void {
		const { filePath, handlers } = this.props;

		// Get markdown content elements
		const contentElements = [this.questionContentEl, this.answerContentEl].filter(Boolean);

		// Attach handler only to markdown content, not the entire card
		contentElements.forEach((el) => {
			el?.addEventListener(
				"click",
				(e: MouseEvent) => {
					const target = e.target;
					if (!(target instanceof HTMLElement)) return;
					const linkEl = target.closest(
						"a.internal-link"
					);
					if (!linkEl) return;

					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();

					const href = linkEl.getAttribute("data-href");
					if (!href) return;

					// Open in existing tab if available
					const existingLeaf = handlers.app.workspace.getMostRecentLeaf();
					if (existingLeaf) {
						void handlers.app.workspace.openLinkText(
							href,
							filePath,
							false
						);
					} else {
						void handlers.app.workspace.openLinkText(
							href,
							filePath,
							"tab"
						);
					}
				},
				true
			); // capture: true
		});
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
