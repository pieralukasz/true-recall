import { ImageService } from "@features/integration/services/ImageService";
import { DuplicateQuestionError } from "@features/study/services/flashcard/card-repository.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { notify } from "@shared/services/notification.service";
import type { ReviewApi } from "@shared/store";
import { BR_REGEX } from "@shared/utils";
import type { App } from "obsidian";

export interface EditHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
}

export class EditHandler {
	private imageService: ImageService;

	constructor(private deps: EditHandlerDeps) {
		this.imageService = new ImageService(deps.app);
	}

	startEdit(field: "question" | "answer"): void {
		const review = this.deps.getReview();
		if (field === "answer" && !review.isAnswerRevealed) {
			return;
		}
		review.startEdit(field);
	}

	async handleInlineImagePaste(
		file: File,
		textarea: HTMLTextAreaElement,
	): Promise<void> {
		try {
			const savedPath =
				await this.imageService.saveImageFromClipboard(file);
			if (!savedPath) {
				notify().warning("Failed to save image");
				return;
			}

			const markdown = this.imageService.buildImageMarkdown(
				savedPath,
				500,
			);
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const value = textarea.value;

			textarea.value =
				value.substring(0, start) + markdown + value.substring(end);
			textarea.selectionStart = textarea.selectionEnd =
				start + markdown.length;
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		} catch (error) {
			console.error("Error saving image:", error);
			notify().operationFailed("save image", error);
		}
	}

	async saveEditFromTextarea(
		textarea: HTMLTextAreaElement,
		field: "question" | "answer",
	): Promise<void> {
		const review = this.deps.getReview();
		const card = review.getCurrentCard();
		const editState = review.getEditState();
		if (!card || !editState.active) return;

		const cardIdBeforeSave = card.id;
		const newContent = textarea.value;

		// Cloze template editing: re-derive all siblings from the new template
		if (
			card.cardType === "cloze" &&
			card.clozeTemplate &&
			card.sourceUid &&
			field === "question"
		) {
			const hasChanges = newContent !== card.clozeTemplate;
			if (hasChanges) {
				try {
					const { hasClozeContent, parseClozeTemplate } = await import(
						"@features/study/services/flashcard/cloze-parser.service"
					);
					if (hasClozeContent(newContent)) {
						this.deps.flashcardManager.updateClozeTemplate(
							card.sourceUid,
							card.clozeTemplate,
							newContent,
							card.sourceNoteName,
						);

						const newCards = parseClozeTemplate(newContent);
						const thisCard = newCards.find(
							(c: { clozeIndex: number }) =>
								c.clozeIndex === card.clozeIndex,
						);
						if (thisCard) {
							review.updateCurrentCardContent(
								thisCard.question,
								thisCard.answer,
							);
						}
						notify().success("Updated cloze template");
					} else {
						this.deps.flashcardManager.updateCardContent(
							cardIdBeforeSave,
							newContent,
							card.answer,
						);
						review.updateCurrentCardContent(newContent, card.answer);
						notify().cardUpdated();
					}
				} catch (error) {
					if (error instanceof DuplicateQuestionError) {
						const sourceInfo = error.existingSourceUid
							? this.deps.flashcardManager
									.getSourceNoteService()
									.resolveSourceNote(error.existingSourceUid)
							: {};
						notify().duplicateFound(
							newContent,
							sourceInfo.noteName,
						);
					} else {
						console.error("Error saving cloze template:", error);
						notify().operationFailed("save cloze template", error);
					}
				}
			}

			review.cancelEdit();
			return;
		}

		const newQuestion = field === "question" ? newContent : card.question;
		const newAnswer = field === "answer" ? newContent : card.answer;

		// Compare with normalized content (convert legacy <br> to newlines)
		const normalizedOriginal =
			field === "question"
				? editState.originalQuestion.replace(BR_REGEX, "\n")
				: editState.originalAnswer.replace(BR_REGEX, "\n");
		const hasChanges = newContent !== normalizedOriginal;

		if (hasChanges) {
			try {
				this.deps.flashcardManager.updateCardContent(
					cardIdBeforeSave,
					newQuestion,
					newAnswer,
				);

				const currentCard = review.getCurrentCard();
				if (currentCard?.id === cardIdBeforeSave) {
					review.updateCurrentCardContent(newQuestion, newAnswer);
					notify().cardUpdated();
				}
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					const sourceInfo = error.existingSourceUid
						? this.deps.flashcardManager
								.getSourceNoteService()
								.resolveSourceNote(error.existingSourceUid)
						: {};
					notify().duplicateFound(newQuestion, sourceInfo.noteName);
				} else {
					console.error("Error saving card content:", error);
					notify().operationFailed("save card", error);
				}
			}
		}

		review.cancelEdit();
	}
}
