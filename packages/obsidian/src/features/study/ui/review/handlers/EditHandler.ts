import { DuplicateQuestionError } from "@features/study/services/flashcard/card-repository.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { notify } from "@shared/services/notification.service";
import type { UndoService } from "@shared/services/undo.service";
import type { ReviewApi } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import { BR_REGEX } from "@shared/utils";
import type { App } from "obsidian";

export interface EditHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
	undoService?: UndoService;
}

export class EditHandler {
	constructor(private deps: EditHandlerDeps) {}

	/**
	 * Auto-save content from the live-preview editor.
	 * Called on editor blur and before card transitions.
	 */
	async saveContent(
		newContent: string,
		field: "question" | "answer",
	): Promise<void> {
		const review = this.deps.getReview();
		const card = review.getCurrentCard();
		if (!card) return;

		const cardIdBeforeSave = card.id;

		// Cloze template editing
		if (
			card.cardType === "cloze" &&
			card.clozeTemplate &&
			card.sourceUid &&
			field === "question"
		) {
			const hasChanges = newContent !== card.clozeTemplate;
			if (!hasChanges) return;

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
						(c: { clozeIndex: number }) => c.clozeIndex === card.clozeIndex,
					);
					if (thisCard) {
						review.updateCurrentCardContent(thisCard.question, thisCard.answer);
					}
				} else {
					this.pushEditUndo(card, "question");
					this.deps.flashcardManager.updateCardContent(
						cardIdBeforeSave,
						newContent,
						card.answer,
					);
					review.updateCurrentCardContent(newContent, card.answer);
				}
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					const sourceInfo = error.existingSourceUid
						? this.deps.flashcardManager
								.getSourceNoteService()
								.resolveSourceNote(error.existingSourceUid)
						: {};
					notify().duplicateFound(newContent, sourceInfo.noteName);
				} else {
					console.error("Error saving cloze template:", error);
					notify().operationFailed("save cloze template", error);
				}
			}
			return;
		}

		// Regular card editing
		const normalizedOriginal =
			field === "question"
				? card.question.replace(BR_REGEX, "\n")
				: (card.answer ?? "").replace(BR_REGEX, "\n");
		const hasChanges = newContent !== normalizedOriginal;
		if (!hasChanges) return;

		const newQuestion = field === "question" ? newContent : card.question;
		const newAnswer = field === "answer" ? newContent : card.answer;

		this.pushEditUndo(card, field);

		try {
			this.deps.flashcardManager.updateCardContent(
				cardIdBeforeSave,
				newQuestion,
				newAnswer,
			);

			const currentCard = review.getCurrentCard();
			if (currentCard?.id === cardIdBeforeSave) {
				review.updateCurrentCardContent(newQuestion, newAnswer);
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

	private pushEditUndo(
		card: FSRSFlashcardItem,
		field: "question" | "answer",
	): void {
		this.deps.undoService?.push({
			id: crypto.randomUUID(),
			actionType: "update",
			description: `Edit card ${field}`,
			timestamp: Date.now(),
			payload: {
				type: "update",
				cardId: card.id,
				previousQuestion: card.question,
				previousAnswer: card.answer ?? "",
			},
		});
	}
}
