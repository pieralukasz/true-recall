import type { SemanticAnswerGradingService } from "@features/ai/services/semantic-answer-grading.service";
import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import type { FSRSService } from "@features/core/services/fsrs.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { ReviewService } from "@features/study/services/review.service";
import { assessTypedAnswer } from "@features/study/ui/review/helpers/answer-assessment";
import { shouldTriggerLeech } from "@features/study/ui/review/helpers/leech-helpers";
import type { SessionFilters } from "@features/study/ui/review/review.types";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import type { AnswerUndoPayload } from "@shared/services/undo.types";
import type { ReviewApi } from "@shared/store";
import type {
	FSRSFlashcardItem,
	FSRSPreset,
	LocalAnswerAssessment,
	SemanticGradingResult,
} from "@shared/types";
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
	getPresetCache: () => Map<string, FSRSPreset>;
	semanticGradingService: SemanticAnswerGradingService;
}

export class AnswerHandler {
	private pendingPreviewRafId: number | null = null;

	constructor(private deps: AnswerHandlerDeps) {}

	resolvePreset(card: FSRSFlashcardItem): FSRSPreset {
		const uid = card.sourceUid ?? "";
		return (
			this.deps.getPresetCache().get(uid) ??
			this.deps.plugin.presetService.resolvePresetForCard(card, {
				projectPath: this.deps.getFilters().projectPath,
			})
		);
	}

	// Let the browser paint the next card before computing the preview
	private deferSchedulingPreview(): void {
		if (this.pendingPreviewRafId !== null) {
			cancelAnimationFrame(this.pendingPreviewRafId);
		}
		this.pendingPreviewRafId = requestAnimationFrame(() => {
			this.pendingPreviewRafId = null;
			this.updateSchedulingPreview();
		});
	}

	updateSchedulingPreview(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (card) {
			const preset = this.resolvePreset(card);
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
		if (!this.deps.getReview().getSchedulingPreview()) {
			this.updateSchedulingPreview();
		}
	}

	prepareTypedAnswerAssessment(typedAnswer: string): {
		card: FSRSFlashcardItem;
		localAssessment: LocalAnswerAssessment;
	} | null {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return null;

		this.handleShowAnswer();

		const localAssessment = assessTypedAnswer(card.answer ?? "", typedAnswer);
		return { card, localAssessment };
	}

	async gradeTypedAnswerSemantically(
		card: FSRSFlashcardItem,
		typedAnswer: string,
		localFallbackScore: number,
		passThreshold: number,
		options?: {
			allowLocalFallback?: boolean;
			sourceContext?: string;
		},
	): Promise<SemanticGradingResult | null> {
		const result = await this.deps.semanticGradingService.gradeAnswer({
			question: card.question,
			correctAnswer: card.answer ?? "",
			userAnswer: typedAnswer,
			passThreshold,
			localFallbackScore,
			sourceContext: options?.sourceContext,
		});

		if (
			options?.allowLocalFallback === false &&
			result.source === "local-fallback"
		) {
			throw new Error("AI grading unavailable. Please rate manually.");
		}

		return result;
	}

	async handleAnswer(rating: Grade): Promise<void> {
		const review = this.deps.getReview();
		const card = review.getCurrentCard();
		if (!card) return;

		const currentIndex = review.currentIndex;
		const responseTime = Date.now() - review.questionShownTime;

		const isNewCard = card.fsrs.state === State.New;
		const previousState = card.fsrs.state;

		const preset = this.resolvePreset(card);
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
				this.deferSchedulingPreview();
			}
			return;
		}

		let requeueData: { card: FSRSFlashcardItem; position: number } | undefined;
		if (this.deps.reviewService.shouldRequeue(updatedCard)) {
			const relativePosition = this.deps.reviewService.getRequeuePosition(
				review.queue,
				review.currentIndex + 1,
				updatedCard,
				preset.reviewOrder ?? this.deps.plugin.settings.reviewOrder,
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

		// Auto-bury siblings (IO + cloze) if enabled
		const buriedSiblings = preset.burySiblings !== false
			? this.burySiblingCards(card)
			: [];

		if (hasMore) {
			this.deferSchedulingPreview();
		}

		// Leech detection: check if card has exceeded the lapse threshold
		if (rating === Rating.Again) {
			this.checkLeech(updatedCard, preset);
		}

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
				buriedSiblingIds: buriedSiblings.length > 0 ? buriedSiblings.map(s => s.id) : undefined,
				buriedSiblings: buriedSiblings.length > 0 ? buriedSiblings : undefined,
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

			const persisted = this.deps.flashcardManager.updateCardFSRS(
				card.id,
				updatedCard.fsrs,
			);
			if (!persisted) {
				const runtimeReview = this.deps.getReview();
				runtimeReview.removeCardById(card.id);
				this.deps.sessionPersistence.removeReviewedCards([card.id]);
				if (!runtimeReview.isComplete()) {
					this.updateSchedulingPreview();
				}
				return;
			}

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
		}, 0);
	}

	/**
	 * Remove sibling IO/cloze cards from the queue after answering one.
	 * Returns the removed cards so they can be restored on undo.
	 */
	private burySiblingCards(card: FSRSFlashcardItem): FSRSFlashcardItem[] {
		if (card.cardType !== "image-occlusion" && card.cardType !== "cloze") {
			return [];
		}
		if (!card.noteId) return [];

		const review = this.deps.getReview();
		const queue = review.queue;
		const currentIdx = review.currentIndex;

		// Find siblings: same noteId, different id, still ahead in queue
		const siblings: FSRSFlashcardItem[] = [];
		for (let i = currentIdx; i < queue.length; i++) {
			const c = queue[i];
			if (c && c.id !== card.id && c.noteId === card.noteId) {
				siblings.push({ ...c });
			}
		}

		// Remove siblings from queue
		for (const sibling of siblings) {
			review.removeCardById(sibling.id);
		}

		return siblings;
	}

	/**
	 * Anki-style leech detection: triggers at threshold, then every half-threshold after.
	 * E.g. with threshold=8: triggers at lapses 8, 12, 16, 20, ...
	 */
	private checkLeech(card: FSRSFlashcardItem, preset: FSRSPreset): void {
		const threshold = preset.leechThreshold ?? 8;
		if (!shouldTriggerLeech(card.fsrs.lapses, threshold)) return;

		const action = preset.leechAction ?? "tag-only";
		const lapses = card.fsrs.lapses;
		const preview = card.question.slice(0, 50);

		if (action === "suspend") {
			this.deps.flashcardManager.updateCardFSRS(card.id, {
				...card.fsrs,
				suspended: true,
			});
			this.deps.getReview().removeCardById(card.id);
			notify().warning(`Leech suspended (${lapses} lapses): ${preview}`);
		} else {
			notify().info(`Leech detected (${lapses} lapses): ${preview}`);
		}
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

			// Restore buried siblings back into the queue before undoing the answer
			if (payload.buriedSiblings && payload.buriedSiblings.length > 0) {
				const review = this.deps.getReview();
				for (const sibling of payload.buriedSiblings) {
					review.insertCardAtPosition(sibling, review.queue.length);
				}
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
