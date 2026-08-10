import { type Grade, Rating } from "ts-fsrs";

import type { SemanticAnswerGradingService } from "@true-recall/core/ai/grading/semantic-answer-grading.service";
import type { TypeInGradingPromptRelatedCard } from "@true-recall/core/ai/prompts/type-in-grading-prompt";
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
import { isPreviewCustomStudy } from "@true-recall/core/types/review-session.types";

import type {
	ReviewGradeOutcome,
	ReviewSessionController,
} from "@true-recall/obsidian/features/study/services/ReviewSessionController";
import type { SessionFilters } from "@true-recall/obsidian/features/study/ui/review/review.types";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

interface AnswerHandlerDeps {
	getReview: () => ReviewApi;
	plugin: TrueRecallPlugin;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	reviewController: ReviewSessionController;
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

	private deferSchedulingPreview(): void {
		if (this.pendingPreviewRafId !== null) {
			cancelAnimationFrame(this.pendingPreviewRafId);
		}
		this.pendingPreviewRafId = window.requestAnimationFrame(() => {
			this.pendingPreviewRafId = null;
			this.updateSchedulingPreview();
		});
	}

	updateSchedulingPreview(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (card) {
			if (isPreviewCustomStudy(this.deps.getFilters())) {
				const now = Date.now();
				this.deps.getReview().setSchedulingPreview({
					again: { due: new Date(now + 60_000), interval: "1m" },
					hard: { due: new Date(now + 600_000), interval: "10m" },
					good: { due: new Date(now), interval: "End" },
					easy: { due: new Date(now), interval: "End" },
				});
				this.deps.getReview().notifyChange();
				return;
			}
			const preset = this.resolvePreset(card);
			const presetSettings =
				this.deps.plugin.presetService.toFSRSSettings(preset);
			const rawPreview = this.deps.fsrsService.getSchedulingPreview(
				card.fsrs,
				presetSettings,
			);
			const preview =
				this.deps.plugin.fsrsHelper?.balanceSchedulingPreview(
					card.id,
					rawPreview,
				) ?? rawPreview;
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
			sourceNotePath?: string;
			relatedCards?: TypeInGradingPromptRelatedCard[];
		},
	): Promise<SemanticGradingResult | null> {
		const result = await this.deps.semanticGradingService.gradeAnswer({
			question: card.question,
			correctAnswer: card.answer ?? "",
			userAnswer: typedAnswer,
			passThreshold,
			localFallbackScore,
			sourceContext: options?.sourceContext,
			sourceNotePath: options?.sourceNotePath,
			relatedCards: options?.relatedCards,
		});

		if (
			options?.allowLocalFallback === false &&
			result.source === "local-fallback"
		) {
			throw new Error("AI grading unavailable. Please rate manually.");
		}

		return result;
	}

	handleAnswer(rating: Grade): ReviewGradeOutcome | null {
		const outcome = this.deps.reviewController.gradeCurrentCard(
			rating,
			this.deps.getFilters(),
		);
		if (!outcome) return null;

		if (this.deps.getFilters().crammingMode) {
			this.deps.getCrammedCardIds().add(outcome.card.id);
		}

		if (outcome.hasMore) {
			this.deferSchedulingPreview();
		}

		if (
			rating === Rating.Again &&
			!isPreviewCustomStudy(this.deps.getFilters())
		) {
			const lapses = outcome.updatedCard.fsrs.lapses;
			const threshold = outcome.preset.leechThreshold ?? 8;
			if (shouldTriggerLeech(lapses, threshold)) {
				const preview = outcome.card.question.slice(0, 50);
				if (outcome.leechSuspended) {
					notify().warning(`Leech suspended (${lapses} lapses): ${preview}`);
				} else {
					notify().info(`Leech detected (${lapses} lapses): ${preview}`);
				}
			}
		}

		return outcome;
	}
}
