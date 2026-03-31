export { buildGlobalPresetQueueContext, buildQueueOptions, filterActiveCards, getEmptyQueueMessage, isGlobalReviewSession, matchesSessionFilters, } from "@true-recall/core/services/review/session-helpers";
import { matchesSessionFilters } from "@true-recall/core/services/review/session-helpers";
import { CARD_MUTATION_ACTION_SEMANTICS, getNormalizedCardMutationAction, } from "@true-recall/obsidian/services/signals";
export function applyMutation(m, review, flashcardManager, cardStore, filters) {
    var _a, _b, _c;
    const normalizedAction = getNormalizedCardMutationAction(m);
    const actionSemantics = normalizedAction
        ? CARD_MUTATION_ACTION_SEMANTICS[normalizedAction]
        : undefined;
    switch (m.type) {
        case "removed": {
            removeCardsFromQueue(review, [m.cardId, ...((_a = m.cardIds) !== null && _a !== void 0 ? _a : [])]);
            break;
        }
        case "updated": {
            const currentCard = review.getCurrentCard();
            if (currentCard && m.cardId && currentCard.id === m.cardId) {
                const updatedData = cardStore.get(m.cardId);
                if (updatedData) {
                    review.updateCurrentCardContent((_b = updatedData.question) !== null && _b !== void 0 ? _b : currentCard.question, (_c = updatedData.answer) !== null && _c !== void 0 ? _c : currentCard.answer);
                }
            }
            if (m.cardId) {
                syncQueueWithMutatedCards([m.cardId], review, flashcardManager, filters);
            }
            break;
        }
        case "bulk": {
            if (!m.cardIds)
                return;
            if (actionSemantics === "queue-remove") {
                removeCardsFromQueue(review, m.cardIds);
                return;
            }
            if (actionSemantics === "queue-sync") {
                // For reset (forget): remove old versions from queue first,
                // so they can be re-added with fresh FSRS data at the end
                const forceRequeue = normalizedAction === "reset";
                if (forceRequeue) {
                    removeCardsFromQueue(review, m.cardIds);
                }
                syncQueueWithMutatedCards(m.cardIds, review, flashcardManager, filters, forceRequeue);
            }
            break;
        }
        case "added": {
            if (!m.cardId)
                return;
            syncQueueWithMutatedCards([m.cardId], review, flashcardManager, filters);
            break;
        }
    }
}
function removeCardsFromQueue(review, cardIds) {
    const uniqueIds = [
        ...new Set(cardIds.filter((id) => Boolean(id))),
    ];
    if (uniqueIds.length === 0)
        return;
    const queueIds = new Set(review.queue.map((c) => c.id));
    const idsToRemove = uniqueIds.filter((id) => queueIds.has(id));
    if (idsToRemove.length > 0) {
        review.removeCardsByIds(idsToRemove);
    }
}
function syncQueueWithMutatedCards(cardIds, review, flashcardManager, filters, forceAdd = false) {
    const uniqueIds = [...new Set(cardIds)];
    if (uniqueIds.length === 0)
        return;
    // When forceAdd: cards were already removed from the queue, but
    // review.queue is a stale snapshot. Use empty set so addCardToQueue()
    // is reached — it uses get() internally for fresh dedup.
    const queueIds = forceAdd
        ? new Set()
        : new Set(review.queue.map((card) => card.id));
    const cards = flashcardManager.getCardsByIds(uniqueIds);
    const cardsById = new Map(cards.map((card) => [card.id, card]));
    const canAutoAdd = forceAdd || canAutoAddMutatedCards(filters);
    const idsToRemove = [];
    for (const id of uniqueIds) {
        const card = cardsById.get(id);
        if (!card || !matchesSessionFilters(card, filters)) {
            if (queueIds.has(id)) {
                idsToRemove.push(id);
            }
            continue;
        }
        if (canAutoAdd && !queueIds.has(id)) {
            review.addCardToQueue(card);
        }
    }
    if (idsToRemove.length > 0) {
        review.removeCardsByIds(idsToRemove);
    }
}
function canAutoAddMutatedCards(filters) {
    var _a;
    const hasDirectScope = Boolean(filters.sourceUidFilter) ||
        Boolean(filters.sourceNoteFilter) ||
        Boolean(filters.filePathFilter) ||
        Boolean((_a = filters.sourceNoteFilters) === null || _a === void 0 ? void 0 : _a.length);
    return !filters.projectPath || hasDirectScope;
}
