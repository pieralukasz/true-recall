import { type Grade, Rating } from "ts-fsrs";

import { shouldTriggerLeech } from "../../helpers/leech-helpers";
import type { SessionPersistenceService } from "../../persistence/session/session-persistence.service";
import type {
	CardSchedulingMeta,
	FSRSSettings,
	ReviewResult,
} from "../../types";
import type { SessionFilters } from "../../types/review-session.types";
import type {
	LeechAction,
	ReviewOrder,
	TrueRecallSettings,
} from "../../types/settings.types";
import type { FSRSService } from "../fsrs/fsrs.service";
import type { HierarchyService } from "../notes/hierarchy.service";
import type { PresetService } from "../notes/preset.service";
import {
	type ActionableSessionSnapshot,
	computeActionableSessionSnapshot,
	type INoteResolver,
} from "./actionable-session-snapshot.service";
import type { ReviewService } from "./review.service";
import { filterActiveCards } from "./session-helpers";

export interface ReviewSessionEngineDeps {
	allCards: CardSchedulingMeta[];
	archivedSourceUids: ReadonlySet<string>;
	settings: TrueRecallSettings;
	sessionPersistence: SessionPersistenceService;
	presetService: PresetService;
	noteResolver?: INoteResolver;
	hierarchyService?: HierarchyService;
	fsrsService?: FSRSService;
	reviewService?: ReviewService;
}

export interface ReviewSessionBootstrapResult
	extends ActionableSessionSnapshot {
	activeCards: CardSchedulingMeta[];
}

export interface ReviewAnswerTransition<T extends CardSchedulingMeta> {
	updatedCard: T;
	result: ReviewResult;
	requeueData?: { card: T; position: number };
	leechSuspended: boolean;
}

export interface ReviewAnswerTransitionOptions {
	responseTime: number;
	presetSettings?: FSRSSettings;
	reviewOrder?: ReviewOrder;
	leechThreshold?: number;
	leechAction?: LeechAction;
	// Skip persistence-coupled side-effects (leech suspend) for transient sessions.
	skipLeechSuspend?: boolean;
}

export function preparePreviewAnswer<T extends CardSchedulingMeta>(
	card: T,
	rating: Grade,
	requeuePosition: number,
	now: Date = new Date(),
): {
	answeredCard: T;
	requeueData?: { card: T; position: number };
} {
	const delaySeconds =
		rating === Rating.Again ? 60 : rating === Rating.Hard ? 600 : 0;
	const answeredCard = { ...card, previewDue: undefined } as T;
	if (delaySeconds === 0) return { answeredCard };

	return {
		answeredCard,
		requeueData: {
			card: {
				...answeredCard,
				previewDue: new Date(now.getTime() + delaySeconds * 1000).toISOString(),
			},
			position: requeuePosition,
		},
	};
}

export class ReviewSessionEngine {
	getActiveCards(
		allCards: CardSchedulingMeta[],
		filters: SessionFilters,
		archivedSourceUids: ReadonlySet<string>,
	): CardSchedulingMeta[] {
		return filterActiveCards(allCards, {
			stateFilter: filters.stateFilter,
			archivedSourceUids: new Set(archivedSourceUids),
		});
	}

	bootstrap(
		deps: ReviewSessionEngineDeps,
		filters: SessionFilters,
	): ReviewSessionBootstrapResult {
		const activeCards = this.getActiveCards(
			deps.allCards,
			filters,
			deps.archivedSourceUids,
		);
		const snapshot = computeActionableSessionSnapshot(
			{
				allCards: deps.allCards,
				archivedSourceUids: deps.archivedSourceUids,
				settings: deps.settings,
				sessionPersistence: deps.sessionPersistence,
				presetService: deps.presetService,
				noteResolver: deps.noteResolver,
				hierarchyService: deps.hierarchyService,
				fsrsService: deps.fsrsService,
				reviewService: deps.reviewService,
			},
			filters,
			{ activeCards },
		);

		return {
			...snapshot,
			activeCards,
		};
	}

	buildQueue(
		deps: ReviewSessionEngineDeps,
		filters: SessionFilters,
	): CardSchedulingMeta[] {
		return this.bootstrap(deps, filters).queue;
	}

	prepareAnswer<T extends CardSchedulingMeta>(
		card: T,
		rating: Grade,
		fsrsService: FSRSService,
		queue: CardSchedulingMeta[],
		startIndex: number,
		options: ReviewAnswerTransitionOptions,
		reviewService: ReviewService,
	): ReviewAnswerTransition<T> {
		let { updatedCard, result } = reviewService.processAnswer(
			card,
			rating,
			fsrsService,
			options.responseTime,
			options.presetSettings,
		);

		let leechSuspended = false;
		if (
			rating === Rating.Again &&
			options.leechAction === "suspend" &&
			!options.skipLeechSuspend &&
			shouldTriggerLeech(updatedCard.fsrs.lapses, options.leechThreshold ?? 8)
		) {
			updatedCard = {
				...updatedCard,
				fsrs: {
					...updatedCard.fsrs,
					suspended: true,
				},
			};
			leechSuspended = true;
		}

		let requeueData: { card: T; position: number } | undefined;
		if (!leechSuspended && reviewService.shouldRequeue(updatedCard)) {
			const position = reviewService.getRequeuePosition(
				queue,
				startIndex,
				updatedCard,
				options.reviewOrder,
			);
			requeueData = {
				card: updatedCard,
				position,
			};
		}

		return {
			updatedCard,
			result,
			requeueData,
			leechSuspended,
		};
	}
}
