/**
 * Card Content Component
 * Renders question and answer with markdown or edit mode
 */
import { MarkdownRenderer, Platform, type App, type Component } from "obsidian";
import { createEditableTextField, TOOLBAR_BUTTONS } from "../../components";
import { UI_CONFIG } from "../../../constants";
import type { FSRSFlashcardItem } from "../../../types";
import type { EditModeState } from "../../../state/store";

export interface CardContentCallbacks {
	onStartEdit: (field: "question" | "answer") => void;
	onSaveEdit: (
		textarea: HTMLTextAreaElement,
		field: "question" | "answer"
	) => Promise<void>;
	onImagePaste?: (file: File, textarea: HTMLTextAreaElement) => Promise<void>;
	isAnswerRevealed?: () => boolean;
}

export interface CardContentDeps {
	app: App;
	component: Component;
}

/**
 * Renders card question and answer content
 * Supports both view mode (markdown) and edit mode (textarea)
 */
export class CardContent {
	// Pre-compiled regex for converting legacy <br> tags
	private static readonly BR_REGEX = /<br\s*\/?>/gi;

	private abortController: AbortController | null = null;

	constructor(
		private readonly deps: CardContentDeps,
		private readonly callbacks: CardContentCallbacks
	) {}

	/**
	 * Render the card content (question and answer)
	 */
	render(
		container: HTMLElement,
		card: FSRSFlashcardItem,
		editState: EditModeState,
		isAnswerRevealed: boolean
	): void {
		// Cleanup previous event listeners
		this.abortController?.abort();
		this.abortController = new AbortController();
		const signal = this.abortController.signal;

		container.empty();

		const cardEl = container.createDiv({
			cls: "ep:w-full ep:text-center",
		});

		const sourcePath = card.sourceNotePath || "";
		const isEditingQuestion =
			editState.active && editState.field === "question";
		const isEditingAnswer = editState.active && editState.field === "answer";

		// Question (always visible)
		this.renderQuestion(cardEl, card, sourcePath, isEditingQuestion, signal);

		// Answer (if revealed and not editing question)
		if (isAnswerRevealed && !isEditingQuestion) {
			this.renderAnswer(cardEl, card, sourcePath, isEditingAnswer, signal);
		}
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.abortController?.abort();
		this.abortController = null;
	}

	private renderQuestion(
		cardEl: HTMLElement,
		card: FSRSFlashcardItem,
		sourcePath: string,
		isEditing: boolean,
		signal: AbortSignal
	): void {
		const questionEl = cardEl.createDiv({
			cls: "true-recall-review-question ep:text-xl ep:leading-relaxed ep:text-obs-normal ep:mb-6",
			attr: { "data-field": "question", "data-source-path": sourcePath },
		});

		if (isEditing) {
			this.renderEditableField(questionEl, card.question, "question");
		} else {
			void MarkdownRenderer.render(
				this.deps.app,
				card.question.replace(CardContent.BR_REGEX, "\n"),
				questionEl,
				sourcePath,
				this.deps.component
			);

			if (Platform.isMobile) {
				this.addLongPressListener(
					questionEl,
					() => this.callbacks.onStartEdit("question"),
					signal
				);
			}
		}
	}

	private renderAnswer(
		cardEl: HTMLElement,
		card: FSRSFlashcardItem,
		sourcePath: string,
		isEditing: boolean,
		signal: AbortSignal
	): void {
		// Separator
		cardEl.createDiv({
			cls: "ep:border-t ep:border-obs-border ep:my-6",
		});

		const answerEl = cardEl.createDiv({
			cls: "true-recall-review-answer ep:text-lg ep:leading-relaxed ep:text-obs-muted",
			attr: { "data-field": "answer", "data-source-path": sourcePath },
		});

		if (isEditing) {
			this.renderEditableField(answerEl, card.answer, "answer");
		} else {
			void MarkdownRenderer.render(
				this.deps.app,
				card.answer.replace(CardContent.BR_REGEX, "\n"),
				answerEl,
				sourcePath,
				this.deps.component
			);

			if (Platform.isMobile) {
				this.addLongPressListener(
					answerEl,
					() => this.callbacks.onStartEdit("answer"),
					signal
				);
			}
		}
	}

	private renderEditableField(
		container: HTMLElement,
		content: string,
		field: "question" | "answer"
	): void {
		container.addClass("ep:relative");

		const editableField = createEditableTextField(container, {
			initialValue: content,
			field,
			showToolbar: true,
			toolbarButtons: TOOLBAR_BUTTONS.UNIFIED,
			toolbarPositioned: true,
			invisibleTextarea: true,
			wrapperClass: "ep:w-full ep:relative",
			autoFocus: true,
			onSave: () => {
				const textarea = editableField.getTextarea();
				if (textarea) {
					void this.callbacks.onSaveEdit(textarea, field);
				}
			},
			onTab: () => {
				const nextField = field === "question" ? "answer" : "question";
				// Only switch to answer if it's revealed
				if (
					nextField === "answer" &&
					this.callbacks.isAnswerRevealed &&
					!this.callbacks.isAnswerRevealed()
				) {
					return;
				}
				const textarea = editableField.getTextarea();
				if (textarea) {
					void (async () => {
						await this.callbacks.onSaveEdit(textarea, field);
						this.callbacks.onStartEdit(nextField);
					})();
				}
			},
		});

		const toolbar = editableField.getToolbar();
		if (toolbar) {
			toolbar.addClass("true-recall-edit-toolbar");
		}

		// Add paste handler for images
		if (this.callbacks.onImagePaste) {
			const textarea = editableField.getTextarea();
			if (textarea) {
				textarea.addEventListener("paste", (e) => {
					const items = e.clipboardData?.items;
					if (!items) return;

					for (const item of Array.from(items)) {
						if (item.type.startsWith("image/")) {
							e.preventDefault();
							const file = item.getAsFile();
							if (file && this.callbacks.onImagePaste) {
								void this.callbacks.onImagePaste(file, textarea);
							}
							return;
						}
					}
				});
			}
		}
	}

	private addLongPressListener(
		element: HTMLElement,
		callback: () => void,
		signal: AbortSignal,
		duration = UI_CONFIG.longPressDuration
	): void {
		let timer: number | null = null;

		element.addEventListener(
			"touchstart",
			() => {
				timer = window.setTimeout(() => {
					callback();
				}, duration);
			},
			{ signal }
		);

		element.addEventListener(
			"touchend",
			() => {
				if (timer) clearTimeout(timer);
			},
			{ signal }
		);

		element.addEventListener(
			"touchmove",
			() => {
				if (timer) clearTimeout(timer);
			},
			{ signal }
		);
	}
}
