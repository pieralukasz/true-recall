import { Rating, State } from "ts-fsrs";

import { CARD_FLAG_META, type CardFlag } from "@true-recall/core/types";

import {
	ReviewBuryCommand,
	ReviewDeleteCommand,
	ReviewForgetCommand,
	ReviewSuspendCommand,
} from "@true-recall/obsidian/commands/commands/review-actions.cmd";
import { MoveCardModal } from "@true-recall/obsidian/modals/shared";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { CardActionContext } from "./CardActionContext";

const FORGET_NON_NEW_WARNING =
	"Forget is only available for cards that are not New.";
export class CardLifecycleActions {
	constructor(private context: CardActionContext) {}

	canUndo(): boolean {
		return this.context.commandService?.canUndo() ?? false;
	}

	canForgetCurrentCard(): boolean {
		const card = this.context.deps.getReview().getCurrentCard();
		return !!card && card.fsrs.state !== State.New;
	}

	/**
	 * Storage deletes cloze siblings and a card's reverse along with it, so the
	 * queue has to drop that whole set. Removing only the visible card would
	 * leave the session showing cards whose rows are already gone.
	 */
	handleDelete(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const cascadeIds = this.context.deps.flashcardManager.getCascadeDeleteIds(
			card.id,
		);
		const deletedIds = cascadeIds.length > 0 ? cascadeIds : [card.id];
		const currentIndex = this.context.deps.getReview().currentIndex;

		const cmd = new ReviewDeleteCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
			siblingIds: deletedIds,
			getReview: () => this.context.deps.getReview(),
		});

		void this.context.commandService?.execute(cmd);
		this.context.removeFromTemporaryDeck(deletedIds);
		this.context.refreshIfActive();
		notify().cardsDeletedWithUndo(deletedIds.length, () => {
			void this.context.commandService?.undo();
		});
	}

	handleSuspend(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const siblingIds = this.getGroupSiblingIds(card);
		const currentIndex = this.context.deps.getReview().currentIndex;

		const cmd = new ReviewSuspendCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
			siblingIds,
			getReview: () => this.context.deps.getReview(),
		});

		void this.context.commandService?.execute(cmd);
		this.context.removeFromTemporaryDeck(siblingIds);
		this.context.refreshIfActive();
		notify().cardSuspended();
	}

	/**
	 * Anki-style card flag. Deliberately outside the undoable Command
	 * pipeline — Anki treats flags as lightweight marks that Ctrl+Z does
	 * not revert, so a direct write + queue refresh matches that behavior.
	 */
	handleSetFlag(flag: CardFlag): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		this.context.deps.cardStore.setCardFlag(card.id, flag);
		this.context.deps.getReview().updateCurrentCardFlag(flag);
		this.context.refreshIfActive();
		notify().cardFlagSet(CARD_FLAG_META[flag].label);
	}

	handleBuryCard(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const buriedUntil = this.getTomorrowDate().toISOString();
		const siblingIds = this.getGroupSiblingIds(card);
		const currentIndex = this.context.deps.getReview().currentIndex;

		const cmd = new ReviewBuryCommand(
			{
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
				siblingIds,
				getReview: () => this.context.deps.getReview(),
			},
			buriedUntil,
		);

		void this.context.commandService?.execute(cmd);
		this.context.removeFromTemporaryDeck(siblingIds);
		this.context.refreshIfActive();
		notify().cardBuried();
	}

	handleForget(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;
		if (card.fsrs.state === State.New) {
			notify().warning(FORGET_NON_NEW_WARNING);
			return;
		}

		const siblingIds = this.getGroupSiblingIds(card);
		const forgettableIds = siblingIds.filter((id) => {
			if (id === card.id) return card.fsrs.state !== State.New;
			const sibling = this.context.deps.cardStore.get(id);
			return !!sibling && sibling.state !== State.New;
		});
		if (forgettableIds.length === 0) {
			notify().warning(FORGET_NON_NEW_WARNING);
			return;
		}

		const currentIndex = this.context.deps.getReview().currentIndex;

		const cmd = new ReviewForgetCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
			siblingIds: forgettableIds,
			getReview: () => this.context.deps.getReview(),
		});

		void this.context.commandService?.execute(cmd);
		this.context.removeFromTemporaryDeck(forgettableIds);
		this.context.refreshIfActive();

		if (forgettableIds.length === 1) {
			notify().cardForgotten();
		} else {
			notify().cardsForgotten(forgettableIds.length);
		}
	}

	handleBuryNote(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const sourceNoteName = card.sourceNoteName;
		if (!sourceNoteName) {
			this.handleBuryCard();
			return;
		}

		const queue = this.context.deps.getReview().queue;
		const siblingCards = queue.filter(
			(c) => c.sourceNoteName === sourceNoteName,
		);

		const firstSibling = siblingCards[0];
		if (siblingCards.length === 0 || !firstSibling) {
			this.handleBuryCard();
			return;
		}

		const currentIndex = this.context.deps.getReview().currentIndex;
		const buriedUntil = this.getTomorrowDate().toISOString();

		const allIds = siblingCards.map((c) => c.id);

		const cmd = new ReviewBuryCommand(
			{
				card: { ...firstSibling },
				originalFsrs: { ...firstSibling.fsrs },
				previousIndex: currentIndex,
				siblingIds: allIds,
				getReview: () => this.context.deps.getReview(),
			},
			buriedUntil,
		);

		void this.context.commandService?.execute(cmd);
		this.context.removeFromTemporaryDeck(allIds);
		this.context.refreshIfActive();
		notify().cardsBuried(siblingCards.length);
	}

	async handleMoveCard(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const modal = new MoveCardModal(this.context.deps.app, {
			cardCount: 1,
			sourceNoteName: card.sourceNoteName,
			cardQuestion: card.question,
			cardAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		try {
			const { persisted } = this.context.deps.reviewService.gradeCard(
				card,
				Rating.Good,
				this.context.deps.fsrsService,
				this.context.deps.flashcardManager,
			);
			if (!persisted) {
				this.context.deps.getReview().removeCardById(card.id);
				this.context.refreshIfActive();
				notify().warning("Card was deleted before move could be saved.");
				return;
			}

			const success = await this.context.deps.flashcardManager.moveCard(
				card.id,
				result.targetNotePath,
			);

			if (success) {
				// Grading and moving both emit synchronous card mutations. Either one
				// can evict the moved card before this await resumes, so removing by
				// cursor here could remove the next card in the queue instead.
				this.context.deps.getReview().removeCardById(card.id);
				this.context.removeFromTemporaryDeck([card.id]);
				this.context.refreshIfActive();
				notify().cardGradedAndMoved();
			}
		} catch (error) {
			console.error("[CardActionsHandler] Error moving card:", error);
			notify().operationFailed("move card", error);
		}
	}

	async handleUndo(): Promise<boolean> {
		const cs = this.context.commandService;
		if (!cs?.canUndo()) {
			notify().nothingToUndo();
			return false;
		}
		return cs.undo();
	}

	private getGroupSiblingIds(card: {
		id: string;
		cardType?: string;
		sourceUid?: string;
		clozeTemplate?: string;
		reverseOf?: string;
	}): string[] {
		if (card.cardType === "cloze" && card.sourceUid && card.clozeTemplate) {
			const siblings = this.context.deps.cardStore.getClozeSiblings(
				card.sourceUid,
				card.clozeTemplate,
			);
			if (siblings.length > 0) return siblings.map((s) => s.id);
		}

		if (card.cardType === "reversed" && card.reverseOf) {
			return [card.id, card.reverseOf];
		}

		const reverseCard = this.context.deps.cardStore.cards.getCardByReverseOf(
			card.id,
		);
		if (reverseCard) return [card.id, reverseCard.id];

		return [card.id];
	}

	private getTomorrowDate(): Date {
		const now = new Date();
		const tomorrow = new Date(now);
		if (now.getHours() >= this.context.deps.settings.dayStartHour) {
			tomorrow.setDate(tomorrow.getDate() + 1);
		}
		tomorrow.setHours(this.context.deps.settings.dayStartHour, 0, 0, 0);
		return tomorrow;
	}
}
