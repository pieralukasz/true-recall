export {
	buildGlobalPresetQueueContext,
	buildQueueOptions,
	filterActiveCards,
	getEmptyQueueMessage,
	isGlobalReviewSession,
} from "@true-recall/core/services/review/session-helpers";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import { matchesSessionFilters } from "@true-recall/core/services/review/session-helpers";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import {
	CARD_MUTATION_ACTION_SEMANTICS,
	type CardMutation,
	getNormalizedCardMutationAction,
} from "@true-recall/obsidian/services/signals";
import type { ReviewApi } from "@true-recall/obsidian/store";

export function applyMutation(
	m: CardMutation,
	review: ReviewApi,
	flashcardManager: FlashcardManager,
	cardStore: SqliteStoreService,
	filters: SessionFilters,
	resolvedProjectUids?: ReadonlySet<string>,
): void {
	const normalizedAction = getNormalizedCardMutationAction(m);
	const actionSemantics = normalizedAction
		? CARD_MUTATION_ACTION_SEMANTICS[normalizedAction]
		: undefined;

	switch (m.type) {
		case "removed": {
			removeCardsFromQueue(review, [m.cardId, ...(m.cardIds ?? [])]);
			break;
		}
		case "updated": {
			const currentCard = review.getCurrentCard();
			if (currentCard && m.cardId && currentCard.id === m.cardId) {
				const updatedData = cardStore.get(m.cardId);
				if (updatedData) {
					review.updateCurrentCardContent(
						updatedData.question ?? currentCard.question,
						updatedData.answer ?? currentCard.answer,
					);
				}
			}
			if (m.cardId) {
				syncQueueWithMutatedCards(
					[m.cardId],
					review,
					flashcardManager,
					filters,
					false,
					resolvedProjectUids,
				);
			}
			break;
		}
		case "bulk": {
			if (!m.cardIds) return;
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
				syncQueueWithMutatedCards(
					m.cardIds,
					review,
					flashcardManager,
					filters,
					forceRequeue,
					resolvedProjectUids,
				);
			}
			break;
		}
		case "added": {
			if (!m.cardId) return;
			syncQueueWithMutatedCards(
				[m.cardId],
				review,
				flashcardManager,
				filters,
				false,
				resolvedProjectUids,
			);
			break;
		}
	}
}

function removeCardsFromQueue(
	review: ReviewApi,
	cardIds: Array<string | undefined>,
): void {
	const uniqueIds = [
		...new Set(cardIds.filter((id): id is string => Boolean(id))),
	];
	if (uniqueIds.length === 0) return;

	const queueIds = new Set(review.queue.map((c) => c.id));
	const idsToRemove = uniqueIds.filter((id) => queueIds.has(id));
	if (idsToRemove.length > 0) {
		review.removeCardsByIds(idsToRemove);
	}
}

function syncQueueWithMutatedCards(
	cardIds: string[],
	review: ReviewApi,
	flashcardManager: FlashcardManager,
	filters: SessionFilters,
	forceAdd = false,
	resolvedProjectUids?: ReadonlySet<string>,
): void {
	const uniqueIds = [...new Set(cardIds)];
	if (uniqueIds.length === 0) return;

	// When forceAdd: cards were already removed from the queue, but
	// review.queue is a stale snapshot. Use empty set so addCardToQueue()
	// is reached — it uses get() internally for fresh dedup.
	const queueIds = forceAdd
		? new Set<string>()
		: new Set(review.queue.map((card) => card.id));
	const cards = flashcardManager.getCardsByIds(uniqueIds);
	const cardsById = new Map(cards.map((card) => [card.id, card]));
	const idsToRemove: string[] = [];

	for (const id of uniqueIds) {
		const card = cardsById.get(id);
		if (!card || !matchesSessionFilters(card, filters)) {
			if (queueIds.has(id)) {
				idsToRemove.push(id);
			}
			continue;
		}

		if (
			!queueIds.has(id) &&
			(forceAdd || canAutoAddCard(card, filters, resolvedProjectUids))
		) {
			review.addCardToQueue(card);
		}
	}

	if (idsToRemove.length > 0) {
		review.removeCardsByIds(idsToRemove);
	}
}

function canAutoAddCard(
	card: CardSchedulingMeta,
	filters: SessionFilters,
	resolvedProjectUids?: ReadonlySet<string>,
): boolean {
	const hasDirectScope =
		Boolean(filters.sourceUidFilter) ||
		Boolean(filters.sourceNoteFilter) ||
		Boolean(filters.filePathFilter) ||
		Boolean(filters.sourceNoteFilters?.length);

	// Direct scope or no project: matchesSessionFilters already validated
	if (!filters.projectPath || hasDirectScope) return true;

	// Project-only scope: check card belongs to project
	if (resolvedProjectUids) {
		return Boolean(card.sourceUid && resolvedProjectUids.has(card.sourceUid));
	}

	// No resolved UIDs available: reject (safety guard)
	return false;
}
