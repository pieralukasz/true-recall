import { CARD_HISTORY_LIMIT } from "@true-recall/core/constants";
import { type CardMutation, notifyCardChange } from "@true-recall/core/events";
import { parseClozeTemplate } from "@true-recall/core/flashcard/parsing/cloze-parser.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type {
	CardReviewLogEntry,
	CardType,
	FSRSCardData,
	FSRSFlashcardItem,
} from "@true-recall/core/types";
import { createDefaultFSRSData } from "@true-recall/core/types";

export interface DuplicateInfo {
	flashcard: { id: string; question: string; answer: string };
	type: "batch" | "existing";
	existingCardId?: string;
	existingSourceUid?: string;
}

export class DuplicateQuestionError extends Error {
	constructor(
		public existingCardId: string,
		public existingSourceUid?: string,
	) {
		super("A card with this question already exists");
		this.name = "DuplicateQuestionError";
	}
}

export interface CreateBatchResult {
	created: FSRSFlashcardItem[];
	duplicates: DuplicateInfo[];
}

export class CardRepository {
	constructor(private store: SqliteStoreService) {}

	/** @throws DuplicateQuestionError if card with same question already exists */
	create(
		question: string,
		answer: string,
		sourceUid?: string,
		sourceNoteName?: string,
		options?: {
			cardType?: CardType;
			clozeTemplate?: string;
			clozeIndex?: number;
			reverseOf?: string;
		},
	): FSRSFlashcardItem {
		const existingInfo = this.store.cards.getCardInfoByQuestion(question);
		if (existingInfo) {
			throw new DuplicateQuestionError(existingInfo.id, existingInfo.sourceUid);
		}

		const cardId = crypto.randomUUID();
		const fsrsData = createDefaultFSRSData(cardId);

		const extendedData: FSRSCardData = {
			...fsrsData,
			question,
			answer,
			sourceUid,
			cardType: options?.cardType,
			clozeTemplate: options?.clozeTemplate,
			clozeIndex: options?.clozeIndex,
			reverseOf: options?.reverseOf,
		};

		this.store.set(cardId, extendedData);

		const card: FSRSFlashcardItem = {
			id: cardId,
			question,
			answer,
			fsrs: extendedData,
			sourceUid,
			sourceNoteName,
			cardType: options?.cardType,
			clozeTemplate: options?.clozeTemplate,
			clozeIndex: options?.clozeIndex,
			reverseOf: options?.reverseOf,
		};

		notifyCardChange({ type: "added", cardId, sourceNoteName });

		return card;
	}

	createBatch(
		flashcards: Array<{
			id: string;
			question: string;
			answer: string;
			cardType?: CardType;
			clozeTemplate?: string;
			clozeIndex?: number;
			reverseOfBatchId?: string;
			sourceText?: string;
		}>,
		sourceUid: string,
		sourceNoteName?: string,
		createdVia?: string,
		sourceText?: string,
	): CreateBatchResult {
		const createdCards: FSRSFlashcardItem[] = [];
		const duplicates: DuplicateInfo[] = [];
		const seenQuestions = new Set<string>();
		// Map batch-level IDs to actual DB IDs for reverse pairing
		const batchIdToDbId = new Map<string, string>();

		for (const flashcard of flashcards) {
			if (seenQuestions.has(flashcard.question)) {
				duplicates.push({
					flashcard,
					type: "batch",
				});
				continue;
			}

			// Cloze-specific duplicate check
			if (
				flashcard.cardType === "cloze" &&
				flashcard.clozeTemplate &&
				flashcard.clozeIndex !== undefined
			) {
				const existingCloze = this.store.cards.findClozeCard(
					sourceUid,
					flashcard.clozeTemplate,
					flashcard.clozeIndex,
				);
				if (existingCloze) {
					const existingCard = this.store.get(existingCloze);
					duplicates.push({
						flashcard,
						type: "existing",
						existingCardId: existingCloze,
						existingSourceUid: existingCard?.sourceUid,
					});
					continue;
				}
			}

			const existingInfo = this.store.cards.getCardInfoByQuestion(
				flashcard.question,
			);
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
			let reverseOf: string | undefined;
			if (flashcard.reverseOfBatchId) {
				reverseOf = batchIdToDbId.get(flashcard.reverseOfBatchId);
			}

			const cardSourceText = flashcard.sourceText ?? sourceText;

			const extendedData: FSRSCardData = {
				...fsrsData,
				question: flashcard.question,
				answer: flashcard.answer,
				sourceUid,
				cardType: flashcard.cardType,
				clozeTemplate: flashcard.clozeTemplate,
				clozeIndex: flashcard.clozeIndex,
				reverseOf,
				createdVia: createdVia ?? "manual",
				sourceText: cardSourceText,
			};

			this.store.set(flashcard.id, extendedData);

			// Track this card's batch ID -> DB ID mapping
			batchIdToDbId.set(flashcard.id, flashcard.id);

			const card: FSRSFlashcardItem = {
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

	get(cardId: string): FSRSCardData | undefined {
		return this.store.get(cardId);
	}

	has(cardId: string): boolean {
		return this.store.has(cardId);
	}

	/** @throws Error if card not found, DuplicateQuestionError if question conflicts */
	updateContent(cardId: string, newQuestion: string, newAnswer: string): void {
		const existing = this.store.get(cardId);
		if (!existing) {
			throw new Error(`Card ${cardId} not found`);
		}

		if (newQuestion !== existing.question) {
			const duplicateInfo = this.store.cards.getCardInfoByQuestion(
				newQuestion,
				cardId,
			);
			if (duplicateInfo) {
				throw new DuplicateQuestionError(
					duplicateInfo.id,
					duplicateInfo.sourceUid,
				);
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

	private syncReversePair(
		cardId: string,
		cardData: FSRSCardData,
		newQuestion: string,
		newAnswer: string,
	): void {
		// Case 1: This card IS a reverse - update the original
		if (cardData.reverseOf) {
			const original = this.store.get(cardData.reverseOf);
			if (original) {
				this.store.cards.updateCardContent(
					cardData.reverseOf,
					newAnswer,
					newQuestion,
				);
			}
		}

		// Case 2: This card HAS a reverse - update the reverse
		const reverseCard = this.store.cards.getCardByReverseOf(cardId);
		if (reverseCard) {
			this.store.cards.updateCardContent(
				reverseCard.id,
				newAnswer,
				newQuestion,
			);
		}
		// No notification — the caller (updateContent) already calls notifyCardChange
	}

	updateFSRS(
		cardId: string,
		newFSRSData: FSRSCardData,
		reviewLogEntry?: CardReviewLogEntry,
		options?: { skipNotification?: boolean },
	): boolean {
		const existing = this.store.get(cardId);
		if (!existing) {
			return false;
		}
		const entry: FSRSCardData = { ...newFSRSData };

		// Append review to history if provided
		if (reviewLogEntry) {
			const history: CardReviewLogEntry[] = existing?.history ?? [];
			history.push(reviewLogEntry);
			// Keep only last N entries
			entry.history =
				history.length > CARD_HISTORY_LIMIT
					? history.slice(-CARD_HISTORY_LIMIT)
					: history;
		} else if (existing?.history) {
			entry.history = existing.history;
		}

		// Preserve question/answer if not in newFSRSData
		if (existing?.question && !entry.question) {
			entry.question = existing.question;
		}
		if (existing?.answer && !entry.answer) {
			entry.answer = existing.answer;
		}
		if (existing?.sourceUid && !entry.sourceUid) {
			entry.sourceUid = existing.sourceUid;
		}
		if (existing?.cardType && !entry.cardType) {
			entry.cardType = existing.cardType;
		}
		if (existing?.clozeTemplate && !entry.clozeTemplate) {
			entry.clozeTemplate = existing.clozeTemplate;
		}
		if (existing?.clozeIndex !== undefined && entry.clozeIndex === undefined) {
			entry.clozeIndex = existing.clozeIndex;
		}
		if (existing?.reverseOf && !entry.reverseOf) {
			entry.reverseOf = existing.reverseOf;
		}
		if (existing?.sourceText && !entry.sourceText) {
			entry.sourceText = existing.sourceText;
		}
		if (existing?.alwaysTypeIn && entry.alwaysTypeIn === undefined) {
			entry.alwaysTypeIn = existing.alwaysTypeIn;
		}
		if (existing?.noteId && !entry.noteId) {
			entry.noteId = existing.noteId;
		}
		if (
			existing?.templateOrd !== undefined &&
			entry.templateOrd === undefined
		) {
			entry.templateOrd = existing.templateOrd;
		}
		if (existing?.noteTypeId && !entry.noteTypeId) {
			entry.noteTypeId = existing.noteTypeId;
		}

		this.store.set(cardId, entry);

		const changes: CardMutation["changes"] = { fsrs: true };
		if (existing && newFSRSData.suspended !== existing.suspended) {
			changes.suspended = true;
		}
		if (existing && newFSRSData.buriedUntil !== existing.buriedUntil) {
			changes.buried = true;
		}

		if (!options?.skipNotification) {
			notifyCardChange({ type: "updated", cardId, changes });
		}
		return true;
	}

	updateSourceUid(cardId: string, newSourceUid: string): boolean {
		const existing = this.store.get(cardId);
		if (!existing) {
			return false;
		}

		this.store.cards.updateCardSourceUid(cardId, newSourceUid);

		notifyCardChange({ type: "updated", cardId, changes: { sourceUid: true } });

		return true;
	}

	updateClozeTemplate(
		sourceUid: string,
		oldTemplate: string,
		newTemplate: string,
		_sourceNoteName?: string,
	): void {
		const siblings = this.store.getClozeSiblings(sourceUid, oldTemplate);
		const siblingsByIndex = new Map(
			siblings
				.filter((s) => s.clozeIndex !== undefined)
				.map((s) => [s.clozeIndex as number, s]),
		);

		const newClozeCards = parseClozeTemplate(newTemplate);
		const newIndices = new Set(newClozeCards.map((c) => c.clozeIndex));
		const affectedCardIds: string[] = [];

		for (const cloze of newClozeCards) {
			const existing = siblingsByIndex.get(cloze.clozeIndex);
			if (existing) {
				this.store.cards.updateClozeCardContent(
					existing.id,
					cloze.question,
					cloze.answer,
					newTemplate,
				);
				affectedCardIds.push(existing.id);
			} else {
				const cardId = crypto.randomUUID();
				const fsrsData = createDefaultFSRSData(cardId);
				const extendedData: FSRSCardData = {
					...fsrsData,
					question: cloze.question,
					answer: cloze.answer,
					sourceUid,
					cardType: "cloze",
					clozeTemplate: newTemplate,
					clozeIndex: cloze.clozeIndex,
				};
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

	delete(cardId: string): boolean {
		return this.deleteWithCascade(cardId).removedIds.length > 0;
	}

	deleteWithCascade(cardId: string): {
		removedIds: string[];
		cardsData: FSRSCardData[];
	} {
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
			.filter((c): c is FSRSCardData => c != null);

		this.store.cards.bulkSoftDelete(removedIds);

		notifyCardChange({ type: "removed", cardId, cardIds: removedIds });

		return { removedIds, cardsData };
	}

	deleteBatch(cardIds: string[]): number {
		return this.deleteBatchWithCascade(cardIds).removedIds.length;
	}

	deleteBatchWithCascade(cardIds: string[]): {
		removedIds: string[];
		cardsData: FSRSCardData[];
	} {
		if (cardIds.length === 0) return { removedIds: [], cardsData: [] };

		const allRemovedIds = new Set<string>();
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
			.filter((c): c is FSRSCardData => c != null);

		this.store.cards.bulkSoftDelete(removedIds);

		notifyCardChange({ type: "bulk", cardIds: removedIds, action: "removed" });

		return { removedIds, cardsData };
	}

	private collectCascadeDeleteIds(cardId: string): string[] {
		const card = this.store.get(cardId);
		if (!card) return [];

		const removedIds = new Set<string>([cardId]);

		// Cascade-delete cloze siblings (all cards sharing the same template)
		if (card.cardType === "cloze" && card.clozeTemplate && card.sourceUid) {
			const siblings = this.store.getClozeSiblings(
				card.sourceUid,
				card.clozeTemplate,
			);
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
	setIfNotExists(cardId: string, fsrsData: FSRSCardData): boolean {
		// Only set if not already exists (prevent overwriting existing data)
		const existing = this.store.get(cardId);
		if (existing) {
			return false;
		}

		this.store.set(cardId, fsrsData);
		return true;
	}
}
