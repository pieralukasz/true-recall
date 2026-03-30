import { DuplicateQuestionError } from "@true-recall/core/flashcard/data/card-repository.service";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { FSRSFlashcardItem } from "@true-recall/core/types";
import { BR_REGEX } from "@true-recall/core/utils";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { UndoService } from "@true-recall/obsidian/services/undo.service";
import type { ReviewApi } from "@true-recall/obsidian/store";
import type { App } from "obsidian";

export interface EditHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
	undoService?: UndoService;
}

export class EditHandler {
	constructor(private deps: EditHandlerDeps) {}

	async saveContent(
		newContent: string,
		field: "question" | "answer",
	): Promise<void> {
		const review = this.deps.getReview();
		const card = review.getCurrentCard();
		if (!card) return;

		const cardIdBeforeSave = card.id;

		if (
			card.cardType === "cloze" &&
			card.clozeTemplate &&
			card.sourceUid &&
			field === "question"
		) {
			await this.saveClozeTemplate(card, newContent, review);
			return;
		}

		const normalizedOriginal =
			field === "question"
				? card.question.replace(BR_REGEX, "\n")
				: (card.answer ?? "").replace(BR_REGEX, "\n");
		if (newContent === normalizedOriginal) return;

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
			this.handleSaveError(error, newQuestion);
		}
	}

	private async saveClozeTemplate(
		card: FSRSFlashcardItem,
		newContent: string,
		review: ReviewApi,
	): Promise<void> {
		if (newContent === card.clozeTemplate) return;

		try {
			const { hasClozeContent, parseClozeTemplate } = await import(
				"@true-recall/core/flashcard/parsing/cloze-parser.service"
			);
			if (hasClozeContent(newContent)) {
				this.deps.flashcardManager.updateClozeTemplate(
					card.sourceUid!,
					card.clozeTemplate!,
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
					card.id,
					newContent,
					card.answer,
				);
				review.updateCurrentCardContent(newContent, card.answer);
			}
		} catch (error) {
			this.handleSaveError(error, newContent);
		}
	}

	private handleSaveError(error: unknown, question: string): void {
		if (error instanceof DuplicateQuestionError) {
			const sourceInfo = error.existingSourceUid
				? this.deps.flashcardManager
						.getSourceNoteService()
						.resolveSourceNote(error.existingSourceUid)
				: {};
			notify().duplicateFound(question, sourceInfo.noteName);
		} else {
			console.error("Error saving card content:", error);
			notify().operationFailed("save card", error);
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
