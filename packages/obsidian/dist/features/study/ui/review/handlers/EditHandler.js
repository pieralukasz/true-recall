import { __awaiter } from "tslib";
import { DuplicateQuestionError } from "@true-recall/core/flashcard/data/card-repository.service";
import { BR_REGEX } from "@true-recall/core/utils";
import { notify } from "@true-recall/obsidian/services/notification.service";
export class EditHandler {
    constructor(deps) {
        this.deps = deps;
    }
    saveContent(newContent, field) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const review = this.deps.getReview();
            const card = review.getCurrentCard();
            if (!card)
                return;
            const cardIdBeforeSave = card.id;
            if (card.cardType === "cloze" &&
                card.clozeTemplate &&
                card.sourceUid &&
                field === "question") {
                yield this.saveClozeTemplate(card, newContent, review);
                return;
            }
            const normalizedOriginal = field === "question"
                ? card.question.replace(BR_REGEX, "\n")
                : ((_a = card.answer) !== null && _a !== void 0 ? _a : "").replace(BR_REGEX, "\n");
            if (newContent === normalizedOriginal)
                return;
            const newQuestion = field === "question" ? newContent : card.question;
            const newAnswer = field === "answer" ? newContent : card.answer;
            this.pushEditUndo(card, field);
            try {
                this.deps.flashcardManager.updateCardContent(cardIdBeforeSave, newQuestion, newAnswer);
                const currentCard = review.getCurrentCard();
                if ((currentCard === null || currentCard === void 0 ? void 0 : currentCard.id) === cardIdBeforeSave) {
                    review.updateCurrentCardContent(newQuestion, newAnswer);
                }
            }
            catch (error) {
                this.handleSaveError(error, newQuestion);
            }
        });
    }
    saveClozeTemplate(card, newContent, review) {
        return __awaiter(this, void 0, void 0, function* () {
            if (newContent === card.clozeTemplate)
                return;
            try {
                const { hasClozeContent, parseClozeTemplate } = yield import("@true-recall/core/flashcard/parsing/cloze-parser.service");
                if (hasClozeContent(newContent)) {
                    this.deps.flashcardManager.updateClozeTemplate(card.sourceUid, card.clozeTemplate, newContent, card.sourceNoteName);
                    const newCards = parseClozeTemplate(newContent);
                    const thisCard = newCards.find((c) => c.clozeIndex === card.clozeIndex);
                    if (thisCard) {
                        review.updateCurrentCardContent(thisCard.question, thisCard.answer);
                    }
                }
                else {
                    this.pushEditUndo(card, "question");
                    this.deps.flashcardManager.updateCardContent(card.id, newContent, card.answer);
                    review.updateCurrentCardContent(newContent, card.answer);
                }
            }
            catch (error) {
                this.handleSaveError(error, newContent);
            }
        });
    }
    handleSaveError(error, question) {
        if (error instanceof DuplicateQuestionError) {
            const sourceInfo = error.existingSourceUid
                ? this.deps.flashcardManager
                    .getSourceNoteService()
                    .resolveSourceNote(error.existingSourceUid)
                : {};
            notify().duplicateFound(question, sourceInfo.noteName);
        }
        else {
            console.error("Error saving card content:", error);
            notify().operationFailed("save card", error);
        }
    }
    pushEditUndo(card, field) {
        var _a, _b;
        (_a = this.deps.undoService) === null || _a === void 0 ? void 0 : _a.push({
            id: crypto.randomUUID(),
            actionType: "update",
            description: `Edit card ${field}`,
            timestamp: Date.now(),
            payload: {
                type: "update",
                cardId: card.id,
                previousQuestion: card.question,
                previousAnswer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
            },
        });
    }
}
