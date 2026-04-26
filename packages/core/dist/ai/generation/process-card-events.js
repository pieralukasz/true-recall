import { __awaiter } from "tslib";
import { addStreamedCard } from "../state/streaming-state";
import { fixSourceText } from "../utils/source-text-fixer";
export function processCardEvents(events, sourceFile, flashcardManager, onPartial, onCount, inputText) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const frontmatterService = flashcardManager.getFrontmatterService();
        let sourceUid = yield frontmatterService.getSourceNoteUid(sourceFile);
        if (!sourceUid) {
            sourceUid = frontmatterService.generateUid();
            yield frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
        }
        const createdIds = [];
        for (const event of events) {
            if (event.type === "card_complete" && event.block) {
                try {
                    const sourceText = inputText && event.block.sourceText
                        ? fixSourceText(event.block.sourceText, inputText)
                        : event.block.sourceText;
                    const result = flashcardManager.createNote({
                        noteTypeId: event.block.noteTypeId,
                        fields: event.block.fields,
                        alwaysTypeIn: event.block.alwaysTypeIn,
                        sourceUid,
                        sourceText,
                        createdVia: "ai",
                    });
                    if (result.cards.length > 0) {
                        onCount(result.cards.length, 0);
                        for (const card of result.cards) {
                            createdIds.push(card.id);
                            addStreamedCard({
                                id: card.id,
                                question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
                                answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
                                cardType: card.cardType,
                                clozeTemplate: card.clozeTemplate,
                                clozeIndex: card.clozeIndex,
                                sourceText: card.sourceText,
                            });
                        }
                    }
                    else {
                        onCount(0, 1);
                    }
                }
                catch (error) {
                    if (error instanceof Error && error.name === "DuplicateQuestionError") {
                        onCount(0, 1);
                    }
                    else {
                        console.error("[processCardEvents] Card creation failed:", error);
                        onCount(0, 1);
                    }
                }
            }
            else if (event.type === "partial_update") {
                onPartial((_c = event.partialQuestion) !== null && _c !== void 0 ? _c : null, (_d = event.partialAnswer) !== null && _d !== void 0 ? _d : null);
            }
        }
        return createdIds;
    });
}
