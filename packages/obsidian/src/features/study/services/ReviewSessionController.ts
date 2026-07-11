import { State } from "ts-fsrs";

import {
	type INoteResolver,
	ReviewSessionEngine,
} from "@true-recall/core/services";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import type {
	CardSchedulingMeta,
	FSRSFlashcardItem,
	FSRSPreset,
	Grade,
	ReviewResult,
} from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import { ObsidianNoteResolver } from "@true-recall/obsidian/adapters/ObsidianNoteResolver";
import { ReviewAnswerCommand } from "@true-recall/obsidian/commands/commands/review-answer.cmd";
import { Q } from "@true-recall/obsidian/data/queries";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type TrueRecallPlugin from "../../../main";

export interface BuiltReviewSession {
	queue: FSRSFlashcardItem[];
	resolvedProjectUids: Set<string> | null;
}

export interface ReviewGradeOutcome {
	card: FSRSFlashcardItem;
	updatedCard: FSRSFlashcardItem;
	result: ReviewResult;
	hasMore: boolean;
	nextCard: FSRSFlashcardItem | null;
	preset: FSRSPreset;
	leechSuspended: boolean;
	buriedSiblings: FSRSFlashcardItem[];
}

export class ReviewSessionController {
	private readonly engine = new ReviewSessionEngine();
	private readonly reviewService = new ReviewService();
	private readonly noteResolver: INoteResolver;

	constructor(
		private readonly plugin: TrueRecallPlugin,
		private readonly getReview: () => ReviewApi,
	) {
		this.noteResolver = new ObsidianNoteResolver(plugin.app);
	}

	private getAllCards(): CardSchedulingMeta[] {
		const allMetaMap =
			this.plugin.dataLayer?.get<Map<string, CardSchedulingMeta>>(Q.ALL_META) ??
			new Map<string, CardSchedulingMeta>();
		return [...allMetaMap.values()];
	}

	buildSession(filters: SessionFilters): BuiltReviewSession {
		const snapshot = this.engine.bootstrap(
			{
				allCards: this.getAllCards(),
				archivedSourceUids:
					this.plugin.hierarchyService.getArchivedSourceUids(),
				settings: this.plugin.settings,
				sessionPersistence: this.plugin.sessionPersistence,
				presetService: this.plugin.presetService,
				noteResolver: this.noteResolver,
				hierarchyService: this.plugin.hierarchyService,
				fsrsService: this.plugin.fsrsService,
				reviewService: this.reviewService,
			},
			filters,
		);

		const queueIds = snapshot.queue.map((card) => card.id);
		const queue = this.plugin.flashcardManager.getCardsByIds(queueIds);
		const resolvedProjectUids = filters.projectPath
			? this.plugin.hierarchyService.getSourceUidsForProject(
					filters.projectPath,
				)
			: null;

		return {
			queue,
			resolvedProjectUids,
		};
	}

	rebuildActiveSession(
		filters: SessionFilters,
		currentCardId?: string | null,
	): void {
		const review = this.getReview();
		if (!review.isActiveSession()) return;

		const { queue } = this.buildSession(filters);
		review.replaceQueue(
			queue,
			currentCardId ?? review.getCurrentCard()?.id ?? null,
		);
	}

	resolvePreset(card: FSRSFlashcardItem, filters: SessionFilters): FSRSPreset {
		return this.plugin.presetService.resolvePresetForCard(card, {
			projectPath: filters.projectPath,
		});
	}

	gradeCurrentCard(
		rating: Grade,
		filters: SessionFilters,
	): ReviewGradeOutcome | null {
		const review = this.getReview();
		const card = review.getCurrentCard();
		if (!card) return null;

		const preset = this.resolvePreset(card, filters);
		const presetSettings = this.plugin.presetService.toFSRSSettings(preset);
		const responseTime = Date.now() - review.questionShownTime;
		const currentIndex = review.currentIndex;
		const isNewCard = card.fsrs.state === State.New;
		const previousState = card.fsrs.state;

		const transition = this.engine.prepareAnswer(
			card,
			rating,
			this.plugin.fsrsService,
			review.queue,
			review.currentIndex + 1,
			{
				responseTime,
				presetSettings,
				reviewOrder: preset.reviewOrder ?? this.plugin.settings.reviewOrder,
				leechThreshold: preset.leechThreshold,
				leechAction: preset.leechAction,
				skipLeechSuspend: filters.crammingMode === true,
			},
			this.reviewService,
		);
		transition.updatedCard = {
			...transition.updatedCard,
			fsrs:
				this.plugin.fsrsHelper?.balanceScheduledReview(
					card.id,
					transition.updatedCard.fsrs,
				) ?? transition.updatedCard.fsrs,
		};

		if (filters.crammingMode) {
			const hasMore = review.recordAnswerAndNext(
				rating,
				transition.updatedCard,
				transition.requeueData,
			);
			return {
				card,
				updatedCard: transition.updatedCard,
				result: transition.result,
				hasMore,
				nextCard: hasMore ? review.getCurrentCard() : null,
				preset,
				leechSuspended: transition.leechSuspended,
				buriedSiblings: [],
			};
		}

		const hasMore = review.recordAnswerAndNext(
			rating,
			transition.updatedCard,
			transition.requeueData,
		);
		const buriedSiblings =
			preset.burySiblings !== false ? this.burySiblingCards(card, review) : [];

		const cmd = new ReviewAnswerCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			updatedFsrs: transition.updatedCard.fsrs,
			previousIndex: currentIndex,
			wasNewCard: isNewCard,
			rating,
			previousState,
			scheduledDays: transition.result.scheduledDays,
			elapsedDays: transition.result.elapsedDays,
			responseTime,
			presetName: preset.name,
			requeuedAtIndex: transition.requeueData?.position,
			buriedSiblingIds:
				buriedSiblings.length > 0 ? buriedSiblings.map((s) => s.id) : undefined,
			buriedSiblings: buriedSiblings.length > 0 ? buriedSiblings : undefined,
		});

		void this.plugin.commandService?.execute(cmd);

		return {
			card,
			updatedCard: transition.updatedCard,
			result: transition.result,
			hasMore,
			nextCard: hasMore ? review.getCurrentCard() : null,
			preset,
			leechSuspended: transition.leechSuspended,
			buriedSiblings,
		};
	}

	private burySiblingCards(
		card: FSRSFlashcardItem,
		review: ReviewApi,
	): FSRSFlashcardItem[] {
		if (card.cardType !== "image-occlusion" && card.cardType !== "cloze") {
			return [];
		}
		if (!card.noteId) return [];

		const siblings: FSRSFlashcardItem[] = [];
		for (let i = review.currentIndex; i < review.queue.length; i++) {
			const candidate = review.queue[i];
			if (
				candidate &&
				candidate.id !== card.id &&
				candidate.noteId === card.noteId
			) {
				siblings.push({ ...candidate });
			}
		}

		for (const sibling of siblings) {
			review.removeCardById(sibling.id);
		}

		return siblings;
	}
}
