import { CARD_HISTORY_LIMIT } from "@true-recall/core/constants";
import { notifyCardChange } from "@true-recall/core/events";
import { parseClozeTemplate } from "@true-recall/core/flashcard/parsing/cloze-parser.service";
import { createDefaultFSRSData } from "@true-recall/core/types";
export class DuplicateQuestionError extends Error {
    constructor(existingCardId, existingSourceUid) {
        super("A card with this question already exists");
        this.existingCardId = existingCardId;
        this.existingSourceUid = existingSourceUid;
        this.name = "DuplicateQuestionError";
    }
}
export class CardRepository {
    constructor(store) {
        this.store = store;
    }
    /** @throws DuplicateQuestionError if card with same question already exists */
    create(question, answer, sourceUid, sourceNoteName, options) {
        const existingInfo = this.store.cards.getCardInfoByQuestion(question);
        if (existingInfo) {
            throw new DuplicateQuestionError(existingInfo.id, existingInfo.sourceUid);
        }
        const cardId = crypto.randomUUID();
        const fsrsData = createDefaultFSRSData(cardId);
        const extendedData = Object.assign(Object.assign({}, fsrsData), { question,
            answer,
            sourceUid, cardType: options === null || options === void 0 ? void 0 : options.cardType, clozeTemplate: options === null || options === void 0 ? void 0 : options.clozeTemplate, clozeIndex: options === null || options === void 0 ? void 0 : options.clozeIndex, reverseOf: options === null || options === void 0 ? void 0 : options.reverseOf });
        this.store.set(cardId, extendedData);
        const card = {
            id: cardId,
            question,
            answer,
            fsrs: extendedData,
            sourceUid,
            sourceNoteName,
            cardType: options === null || options === void 0 ? void 0 : options.cardType,
            clozeTemplate: options === null || options === void 0 ? void 0 : options.clozeTemplate,
            clozeIndex: options === null || options === void 0 ? void 0 : options.clozeIndex,
            reverseOf: options === null || options === void 0 ? void 0 : options.reverseOf,
        };
        notifyCardChange({ type: "added", cardId, sourceNoteName });
        return card;
    }
    createBatch(flashcards, sourceUid, sourceNoteName, createdVia, sourceText) {
        var _a;
        const createdCards = [];
        const duplicates = [];
        const seenQuestions = new Set();
        // Map batch-level IDs to actual DB IDs for reverse pairing
        const batchIdToDbId = new Map();
        for (const flashcard of flashcards) {
            if (seenQuestions.has(flashcard.question)) {
                duplicates.push({
                    flashcard,
                    type: "batch",
                });
                continue;
            }
            // Cloze-specific duplicate check
            if (flashcard.cardType === "cloze" &&
                flashcard.clozeTemplate &&
                flashcard.clozeIndex !== undefined) {
                const existingCloze = this.store.cards.findClozeCard(sourceUid, flashcard.clozeTemplate, flashcard.clozeIndex);
                if (existingCloze) {
                    const existingCard = this.store.get(existingCloze);
                    duplicates.push({
                        flashcard,
                        type: "existing",
                        existingCardId: existingCloze,
                        existingSourceUid: existingCard === null || existingCard === void 0 ? void 0 : existingCard.sourceUid,
                    });
                    continue;
                }
            }
            const existingInfo = this.store.cards.getCardInfoByQuestion(flashcard.question);
            if (existingInfo) {
                duplicates.push({
                    flashcard,
                    type: "existing",
                    existingCardId: existingInfo.id,
                    existingSourceUid: existingInfo.sourceUid,
                });
                continue;
            }
            // Mark question as seen and create the card
            seenQuestions.add(flashcard.question);
            const fsrsData = createDefaultFSRSData(flashcard.id);
            // Resolve reverse_of: if this card references a batch ID, look up the real DB ID
            let reverseOf;
            if (flashcard.reverseOfBatchId) {
                reverseOf = batchIdToDbId.get(flashcard.reverseOfBatchId);
            }
            const cardSourceText = (_a = flashcard.sourceText) !== null && _a !== void 0 ? _a : sourceText;
            const extendedData = Object.assign(Object.assign({}, fsrsData), { question: flashcard.question, answer: flashcard.answer, sourceUid, cardType: flashcard.cardType, clozeTemplate: flashcard.clozeTemplate, clozeIndex: flashcard.clozeIndex, reverseOf, createdVia: createdVia !== null && createdVia !== void 0 ? createdVia : "manual", sourceText: cardSourceText });
            this.store.set(flashcard.id, extendedData);
            // Track this card's batch ID -> DB ID mapping
            batchIdToDbId.set(flashcard.id, flashcard.id);
            const card = {
                id: flashcard.id,
                question: flashcard.question,
                answer: flashcard.answer,
                fsrs: extendedData,
                sourceNoteName,
                sourceUid,
                cardType: flashcard.cardType,
                clozeTemplate: flashcard.clozeTemplate,
                clozeIndex: flashcard.clozeIndex,
                reverseOf,
                sourceText: cardSourceText,
            };
            createdCards.push(card);
        }
        if (createdCards.length > 0) {
            notifyCardChange({
                type: "bulk",
                cardIds: createdCards.map((c) => c.id),
            });
        }
        return { created: createdCards, duplicates };
    }
    get(cardId) {
        return this.store.get(cardId);
    }
    has(cardId) {
        return this.store.has(cardId);
    }
    /** @throws Error if card not found, DuplicateQuestionError if question conflicts */
    updateContent(cardId, newQuestion, newAnswer) {
        const existing = this.store.get(cardId);
        if (!existing) {
            throw new Error(`Card ${cardId} not found`);
        }
        if (newQuestion !== existing.question) {
            const duplicateInfo = this.store.cards.getCardInfoByQuestion(newQuestion, cardId);
            if (duplicateInfo) {
                throw new DuplicateQuestionError(duplicateInfo.id, duplicateInfo.sourceUid);
            }
        }
        this.store.cards.updateCardContent(cardId, newQuestion, newAnswer);
        notifyCardChange({
            type: "updated",
            cardId,
            changes: { question: true, answer: true },
        });
        // Sync reversed pair: update the paired card with swapped Q/A
        this.syncReversePair(cardId, existing, newQuestion, newAnswer);
    }
    syncReversePair(cardId, cardData, newQuestion, newAnswer) {
        // Case 1: This card IS a reverse - update the original
        if (cardData.reverseOf) {
            const original = this.store.get(cardData.reverseOf);
            if (original) {
                this.store.cards.updateCardContent(cardData.reverseOf, newAnswer, newQuestion);
            }
        }
        // Case 2: This card HAS a reverse - update the reverse
        const reverseCard = this.store.cards.getCardByReverseOf(cardId);
        if (reverseCard) {
            this.store.cards.updateCardContent(reverseCard.id, newAnswer, newQuestion);
        }
        // No notification — the caller (updateContent) already calls notifyCardChange
    }
    updateFSRS(cardId, newFSRSData, reviewLogEntry, options) {
        var _a;
        const existing = this.store.get(cardId);
        if (!existing) {
            return false;
        }
        const entry = Object.assign({}, newFSRSData);
        // Append review to history if provided
        if (reviewLogEntry) {
            const history = (_a = existing === null || existing === void 0 ? void 0 : existing.history) !== null && _a !== void 0 ? _a : [];
            history.push(reviewLogEntry);
            // Keep only last N entries
            entry.history =
                history.length > CARD_HISTORY_LIMIT
                    ? history.slice(-CARD_HISTORY_LIMIT)
                    : history;
        }
        else if (existing === null || existing === void 0 ? void 0 : existing.history) {
            entry.history = existing.history;
        }
        // Preserve question/answer if not in newFSRSData
        if ((existing === null || existing === void 0 ? void 0 : existing.question) && !entry.question) {
            entry.question = existing.question;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.answer) && !entry.answer) {
            entry.answer = existing.answer;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.sourceUid) && !entry.sourceUid) {
            entry.sourceUid = existing.sourceUid;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.cardType) && !entry.cardType) {
            entry.cardType = existing.cardType;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.clozeTemplate) && !entry.clozeTemplate) {
            entry.clozeTemplate = existing.clozeTemplate;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.clozeIndex) !== undefined && entry.clozeIndex === undefined) {
            entry.clozeIndex = existing.clozeIndex;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.reverseOf) && !entry.reverseOf) {
            entry.reverseOf = existing.reverseOf;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.sourceText) && !entry.sourceText) {
            entry.sourceText = existing.sourceText;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.alwaysTypeIn) && entry.alwaysTypeIn === undefined) {
            entry.alwaysTypeIn = existing.alwaysTypeIn;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.noteId) && !entry.noteId) {
            entry.noteId = existing.noteId;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.templateOrd) !== undefined &&
            entry.templateOrd === undefined) {
            entry.templateOrd = existing.templateOrd;
        }
        if ((existing === null || existing === void 0 ? void 0 : existing.noteTypeId) && !entry.noteTypeId) {
            entry.noteTypeId = existing.noteTypeId;
        }
        this.store.set(cardId, entry);
        const changes = { fsrs: true };
        if (existing && newFSRSData.suspended !== existing.suspended) {
            changes.suspended = true;
        }
        if (existing && newFSRSData.buriedUntil !== existing.buriedUntil) {
            changes.buried = true;
        }
        if (!(options === null || options === void 0 ? void 0 : options.skipNotification)) {
            notifyCardChange({ type: "updated", cardId, changes });
        }
        return true;
    }
    updateSourceUid(cardId, newSourceUid) {
        const existing = this.store.get(cardId);
        if (!existing) {
            return false;
        }
        this.store.cards.updateCardSourceUid(cardId, newSourceUid);
        notifyCardChange({ type: "updated", cardId, changes: { sourceUid: true } });
        return true;
    }
    updateClozeTemplate(sourceUid, oldTemplate, newTemplate, _sourceNoteName) {
        const siblings = this.store.getClozeSiblings(sourceUid, oldTemplate);
        const siblingsByIndex = new Map(siblings
            .filter((s) => s.clozeIndex !== undefined)
            .map((s) => [s.clozeIndex, s]));
        const newClozeCards = parseClozeTemplate(newTemplate);
        const newIndices = new Set(newClozeCards.map((c) => c.clozeIndex));
        const affectedCardIds = [];
        for (const cloze of newClozeCards) {
            const existing = siblingsByIndex.get(cloze.clozeIndex);
            if (existing) {
                this.store.cards.updateClozeCardContent(existing.id, cloze.question, cloze.answer, newTemplate);
                affectedCardIds.push(existing.id);
            }
            else {
                const cardId = crypto.randomUUID();
                const fsrsData = createDefaultFSRSData(cardId);
                const extendedData = Object.assign(Object.assign({}, fsrsData), { question: cloze.question, answer: cloze.answer, sourceUid, cardType: "cloze", clozeTemplate: newTemplate, clozeIndex: cloze.clozeIndex });
                this.store.set(cardId, extendedData);
                affectedCardIds.push(cardId);
            }
        }
        for (const [index, sibling] of siblingsByIndex) {
            if (!newIndices.has(index)) {
                this.store.cards.softDeleteWithCascade(sibling.id);
                affectedCardIds.push(sibling.id);
            }
        }
        if (affectedCardIds.length > 0) {
            notifyCardChange({ type: "bulk", cardIds: affectedCardIds });
        }
    }
    delete(cardId) {
        return this.deleteWithCascade(cardId).removedIds.length > 0;
    }
    deleteWithCascade(cardId) {
        const card = this.store.get(cardId);
        if (!card) {
            return { removedIds: [], cardsData: [] };
        }
        const removedIds = this.collectCascadeDeleteIds(cardId);
        if (removedIds.length === 0) {
            return { removedIds: [], cardsData: [] };
        }
        // Capture full card data before deletion for undo support
        const cardsData = removedIds
            .map((id) => this.store.get(id))
            .filter((c) => c != null);
        this.store.cards.bulkSoftDelete(removedIds);
        notifyCardChange({ type: "removed", cardId, cardIds: removedIds });
        return { removedIds, cardsData };
    }
    deleteBatch(cardIds) {
        return this.deleteBatchWithCascade(cardIds).removedIds.length;
    }
    deleteBatchWithCascade(cardIds) {
        if (cardIds.length === 0)
            return { removedIds: [], cardsData: [] };
        const allRemovedIds = new Set();
        for (const cardId of cardIds) {
            const ids = this.collectCascadeDeleteIds(cardId);
            for (const id of ids) {
                allRemovedIds.add(id);
            }
        }
        if (allRemovedIds.size === 0) {
            return { removedIds: [], cardsData: [] };
        }
        const removedIds = [...allRemovedIds];
        // Capture full card data before deletion for undo support
        const cardsData = removedIds
            .map((id) => this.store.get(id))
            .filter((c) => c != null);
        this.store.cards.bulkSoftDelete(removedIds);
        notifyCardChange({ type: "bulk", cardIds: removedIds, action: "removed" });
        return { removedIds, cardsData };
    }
    collectCascadeDeleteIds(cardId) {
        const card = this.store.get(cardId);
        if (!card)
            return [];
        const removedIds = new Set([cardId]);
        // Cascade-delete cloze siblings (all cards sharing the same template)
        if (card.cardType === "cloze" && card.clozeTemplate && card.sourceUid) {
            const siblings = this.store.getClozeSiblings(card.sourceUid, card.clozeTemplate);
            for (const sibling of siblings) {
                removedIds.add(sibling.id);
            }
        }
        // If this is an original card with a reverse, cascade-delete the reverse
        if (!card.reverseOf) {
            const reverseCard = this.store.cards.getCardByReverseOf(cardId);
            if (reverseCard) {
                removedIds.add(reverseCard.id);
            }
        }
        return [...removedIds];
    }
    /** Returns true if card was saved, false if skipped (already exists) */
    setIfNotExists(cardId, fsrsData) {
        // Only set if not already exists (prevent overwriting existing data)
        const existing = this.store.get(cardId);
        if (existing) {
            return false;
        }
        this.store.set(cardId, fsrsData);
        return true;
    }
}
