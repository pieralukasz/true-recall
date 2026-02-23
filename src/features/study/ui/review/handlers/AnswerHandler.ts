import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import type { FSRSService } from "@features/core/services/fsrs.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { ReviewService } from "@features/study/services/review.service";
import type { SessionFilters } from "@features/study/ui/review/review.types";
import { notifyCardChange } from "@shared/services/signals";
import type { AnswerUndoPayload } from "@shared/services/undo.types";
import type { ReviewApi } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import { type Grade, Rating, State } from "ts-fsrs";
import type TrueRecallPlugin from "../../../../../main";

export interface AnswerHandlerDeps {
	getReview: () => ReviewApi;
	plugin: TrueRecallPlugin;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	flashcardManager: FlashcardManager;
	sessionPersistence: SessionPersistenceService;
	getFilters: () => SessionFilters;
	getCrammedCardIds: () => Set<string>;
}

export class AnswerHandler {
	constructor(private deps: AnswerHandlerDeps) {}

	updateSchedulingPreview(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (card) {
			const preset = this.deps.plugin.presetService.resolvePresetForCard(card);
			const presetSettings =
				this.deps.plugin.presetService.toFSRSSettings(preset);
			const preview = this.deps.fsrsService.getSchedulingPreview(
				card.fsrs,
				presetSettings,
			);
			this.deps.getReview().setSchedulingPreview(preview);
		}
	}

	handleShowAnswer(): void {
		this.deps.getReview().revealAnswer();
		this.updateSchedulingPreview();
	}

	async handleAnswer(rating: Grade): Promise<void> {
		const review = this.deps.getReview();
		const card = review.getCurrentCard();
		if (!card) return;

		const currentIndex = review.currentIndex;
		const responseTime = Date.now() - review.questionShownTime;

		const isNewCard = card.fsrs.state === State.New;
		const previousState = card.fsrs.state;

		const preset = this.deps.plugin.presetService.resolvePresetForCard(card);
		const presetSettings =
			this.deps.plugin.presetService.toFSRSSettings(preset);

		const { updatedCard, result } = this.deps.reviewService.processAnswer(
			card,
			rating,
			this.deps.fsrsService,
			responseTime,
			presetSettings,
		);

		// Cramming mode: skip persistence
		if (this.deps.getFilters().crammingMode) {
			this.deps.getCrammedCardIds().add(card.id);
			const hasMore = review.recordAnswerAndNext(rating, updatedCard);
			if (hasMore) {
				this.updateSchedulingPreview();
			}
			return;
		}

		let requeueData: { card: FSRSFlashcardItem; position: number } | undefined;
		if (this.deps.reviewService.shouldRequeue(updatedCard)) {
			const relativePosition = this.deps.reviewService.getRequeuePosition(
				review.queue,
				review.currentIndex + 1,
				updatedCard,
				this.deps.plugin.settings.reviewOrder,
			);
			requeueData = {
				card: updatedCard,
				position: relativePosition,
			};
		}

		const hasMore = review.recordAnswerAndNext(
			rating,
			updatedCard,
			requeueData,
		);

		// Undo entry with deferred persistence
		let writeExecuted = false;
		let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

		this.deps.plugin.undoService?.push({
			id: crypto.randomUUID(),
			actionType: "answer",
			description: `Review (${Rating[rating]})`,
			timestamp: Date.now(),
			payload: {
				type: "answer",
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
				wasNewCard: isNewCard,
				rating,
				previousState,
				requeuedAtIndex: requeueData?.position,
			},
			cancelPendingWrite: () => {
				if (!writeExecuted && pendingTimeoutId !== null) {
					clearTimeout(pendingTimeoutId);
					pendingTimeoutId = null;
					return true;
				}
				return false;
			},
		});

		// Defer persistence until after the browser paints the next card
		pendingTimeoutId = setTimeout(() => {
			writeExecuted = true;
			pendingTimeoutId = null;

			this.deps.flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);

			try {
				this.deps.sessionPersistence.recordReview(
					card.id,
					isNewCard,
					responseTime,
					rating,
					previousState,
					result.scheduledDays,
					result.elapsedDays,
					preset.name,
				);
			} catch (error) {
				console.error("Error recording review to persistent storage:", error);
			}

			notifyCardChange({
				type: "reviewed",
				cardId: card.id,
				rating: rating as number,
				newState: updatedCard.fsrs.state,
			});

			if (hasMore) {
				this.updateSchedulingPreview();
			}
		}, 0);
	}

	async handleUndoAnswer(
		payload: AnswerUndoPayload,
		writeCancelled: boolean,
	): Promise<void> {
		try {
			if (!writeCancelled) {
				this.deps.sessionPersistence.removeLastReview(
					payload.card.id,
					payload.wasNewCard ?? false,
					payload.rating,
					payload.previousState,
				);
			}

			this.deps
				.getReview()
				.undoLastAnswer(
					payload.previousIndex,
					{ ...payload.card, fsrs: payload.originalFsrs },
					payload.requeuedAtIndex,
				);
		} catch (error) {
			console.error("Error undoing answer:", error);
		}
	}
}
