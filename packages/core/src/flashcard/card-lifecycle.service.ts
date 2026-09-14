import type { CardRepository } from "./data/card-repository.service";
import type { DeleteFlashcardsResult } from "./flashcard.types";

export class CardLifecycleService {
	constructor(
		private getRepository: () => CardRepository | null,
		private removeReviewedCards: (ids: string[]) => void,
	) {}
	private get cardRepository() {
		return this.getRepository();
	}

	removeFlashcard(cardId: string): boolean {
		return this.removeFlashcardById(cardId);
	}

	removeFlashcardById(cardId: string): boolean {
		const result = this.removeFlashcardByIdWithDetails(cardId);
		return result.ok;
	}

	removeFlashcardByIdWithDetails(cardId: string): DeleteFlashcardsResult {
		if (!this.cardRepository) {
			return {
				ok: false,
				affectedIds: [],
				affectedCount: 0,
				deletedCardsData: [],
			};
		}
		const { removedIds, cardsData } =
			this.cardRepository.deleteWithCascade(cardId);
		if (removedIds.length > 0) {
			this.removeReviewedCards(removedIds);
			return {
				ok: true,
				affectedIds: removedIds,
				affectedCount: removedIds.length,
				deletedCardsData: cardsData,
			};
		}
		return {
			ok: false,
			affectedIds: [],
			affectedCount: 0,
			deletedCardsData: [],
		};
	}

	removeFlashcardsByIds(cardIds: string[]): number {
		const result = this.removeFlashcardsByIdsWithDetails(cardIds);
		return result.affectedCount;
	}

	/** Ids {@link removeFlashcardsByIdsWithDetails} would delete for this card. */
	getCascadeDeleteIds(cardId: string): string[] {
		if (!this.cardRepository) return [];
		return this.cardRepository.getCascadeDeleteIds(cardId);
	}

	removeFlashcardsByIdsWithDetails(cardIds: string[]): DeleteFlashcardsResult {
		if (!this.cardRepository) {
			return {
				ok: false,
				affectedIds: [],
				affectedCount: 0,
				deletedCardsData: [],
			};
		}
		const { removedIds, cardsData } =
			this.cardRepository.deleteBatchWithCascade(cardIds);
		if (removedIds.length > 0) {
			this.removeReviewedCards(removedIds);
		}
		return {
			ok: removedIds.length > 0,
			affectedIds: removedIds,
			affectedCount: removedIds.length,
			deletedCardsData: cardsData,
		};
	}

	removeFlashcardFromSql(cardId: string): void {
		void this.removeFlashcardById(cardId);
	}
}
