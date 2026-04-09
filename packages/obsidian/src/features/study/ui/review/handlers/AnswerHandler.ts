import { type Grade, Rating, State } from "ts-fsrs";

import type { SemanticAnswerGradingService } from "@true-recall/core/ai/grading/semantic-answer-grading.service";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import { assessTypedAnswer } from "@true-recall/core/helpers/answer-assessment";
import { shouldTriggerLeech } from "@true-recall/core/helpers/leech-helpers";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { ReviewService } from "@true-recall/core/services/review/review.service";
import type {
	FSRSFlashcardItem,
	FSRSPreset,
	LocalAnswerAssessment,
	SemanticGradingResult,
} from "@true-recall/core/types";

import type { CommandService } from "@true-recall/obsidian/commands";
import { ReviewAnswerCommand } from "@true-recall/obsidian/commands/commands/review-answer.cmd";
import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

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

	private get commandService(): CommandService | null {
		return this.deps.plugin.commandService ?? null;
	}

	resolvePreset(card: FSRSFlashcardItem): FSRSPreset {
		const uid = card.sourceUid ?? "";
		return (
			this.deps.getPresetCache().get(uid) ??
			this.deps.plugin.presetService.resolvePresetForCard(card, {
				projectPath: this.deps.getFilters().projectPath,
			})
		);
	}

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
			this.deps.getReview().notifyChange();
		}
	}

	handleShowAnswer(): void {
		this.deps.getReview().revealAnswer();
		if (!this.deps.getReview().getSchedulingPreview()) {
			this.deferSchedulingPreview();
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

	handleAnswer(rating: Grade): void {
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
		const buriedSiblings =
			preset.burySiblings !== false ? this.burySiblingCards(card) : [];

		if (hasMore) {
			this.deferSchedulingPreview();
		}

		// Leech detection
		if (rating === Rating.Again) {
			this.checkLeech(updatedCard, preset);
		}

		// Push command for undo (deferred write happens inside the command)
		const cmd = new ReviewAnswerCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			updatedFsrs: updatedCard.fsrs,
			previousIndex: currentIndex,
			wasNewCard: isNewCard,
			rating,
			previousState,
			scheduledDays: result.scheduledDays,
			elapsedDays: result.elapsedDays,
			responseTime,
			presetName: preset.name,
			requeuedAtIndex: requeueData?.position,
			buriedSiblingIds:
				buriedSiblings.length > 0 ? buriedSiblings.map((s) => s.id) : undefined,
			buriedSiblings: buriedSiblings.length > 0 ? buriedSiblings : undefined,
		});

		void this.commandService?.execute(cmd);
	}

	// Remove sibling IO/cloze cards from the queue after answering one.
	// Returns removed cards so they can be restored on undo.
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

	// Anki-style leech detection
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
}
