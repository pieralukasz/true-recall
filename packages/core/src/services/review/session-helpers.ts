import { Rating, State } from "ts-fsrs";

import {
	MS_PER_DAY,
	WEAK_CARD_STABILITY_THRESHOLD,
} from "@true-recall/core/constants";
import {
	isCardActive,
	isLearningState,
} from "@true-recall/core/helpers/card-state";
import type {
	PresetDailyProgress,
	SessionPersistenceService,
} from "@true-recall/core/persistence/session/session-persistence.service";
import { resolveRModeOptions } from "@true-recall/core/services/review/retrievability-queue";
import type { QueueBuildOptions } from "@true-recall/core/services/review/review.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";
import { getTodayBoundary } from "@true-recall/core/utils/date.utils";

export interface CardFilterOptions {
	stateFilter?: "due" | "learning" | "new" | "buried";
	archivedSourceUids?: Set<string>;
}

interface PresetServiceLike {
	getPresets(): FSRSPreset[];
	getDefaultPreset(): FSRSPreset;
	resolvePresetForCard(card: CardSchedulingMeta): FSRSPreset;
}

export interface GlobalPresetQueueContext {
	cardPresetById: Map<string, string>;
	presetDailyLimits: Map<
		string,
		{
			newCardsPerDay: number;
			reviewsPerDay: number;
		}
	>;
	presetProgressToday: Map<string, PresetDailyProgress>;
	defaultPresetName: string;
}

/**
 * Persistence-backed values shared by every queue built in one UI
 * aggregation. Dashboard note/project snapshots are computed synchronously;
 * capturing these once prevents an identical SQL query per scope.
 */
export interface SessionProgressSnapshot {
	reviewedToday: Set<string>;
	presetProgressToday: Map<string, PresetDailyProgress>;
}

export function captureSessionProgress(
	sessionPersistence: SessionPersistenceService,
): SessionProgressSnapshot {
	return {
		reviewedToday: sessionPersistence.getReviewedToday(),
		presetProgressToday: sessionPersistence.getTodayProgressByPreset(),
	};
}

/**
 * Returns active (non-suspended, non-buried, non-archived) cards, or specifically
 * buried cards if stateFilter is "buried"
 */
export function filterActiveCards(
	cards: CardSchedulingMeta[],
	options: CardFilterOptions = {},
): CardSchedulingMeta[] {
	const now = new Date();
	const { stateFilter, archivedSourceUids } = options;

	return cards.filter((card) => {
		if (archivedSourceUids?.has(card.sourceUid ?? "")) return false;

		// Buried-only mode: return only currently buried cards
		if (stateFilter === "buried") {
			if (card.fsrs.suspended) return false;
			if (!card.fsrs.buriedUntil) return false;
			return new Date(card.fsrs.buriedUntil) > now;
		}

		return isCardActive(card.fsrs.suspended, card.fsrs.buriedUntil, now);
	});
}

export function getEmptyQueueMessage(
	stateFilter?: string,
	rModeActive = false,
): string {
	if (stateFilter === "buried") {
		return "No buried cards found.";
	}
	if (rModeActive) return "Nothing worth reviewing right now.";

	return "Congratulations! No cards due for review.";
}

export function buildQueueOptions(
	filters: SessionFilters,
	settings: TrueRecallSettings,
	sessionPersistence: SessionPersistenceService,
	preset?: FSRSPreset,
	sessionProgress?: SessionProgressSnapshot,
): QueueBuildOptions {
	// When scoped to a single preset (per-project/per-note snapshots), match
	// today's progress to that preset so its remaining budget isn't drained
	// by reviews from other presets. Global sessions don't pass a preset and
	// use the aggregate counters instead.
	const presetProgress = preset
		? (
				sessionProgress?.presetProgressToday ??
				sessionPersistence.getTodayProgressByPreset()
			).get(preset.name)
		: undefined;
	const newCardsStudiedToday = preset
		? (presetProgress?.newStudied ?? 0)
		: sessionPersistence.getNewCardsStudiedToday();
	const reviewsCompletedToday = preset
		? (presetProgress?.reviewsCompleted ?? 0)
		: sessionPersistence.getReviewCardsCompletedToday();

	const customStudy = filters.customStudy;
	const forgottenCardIds =
		customStudy?.kind === "forgotten"
			? sessionPersistence.getCardsRatedAgainWithinDays(customStudy.days)
			: undefined;
	const temporaryDeckCardIds = new Set(
		(settings.temporaryCustomStudyDecks ?? [])
			.filter((deck) => deck.id !== filters.temporaryDeckId)
			.flatMap((deck) => deck.cardIds),
	);

	return {
		newCardsLimit: preset?.newCardsPerDay ?? settings.newCardsPerDay,
		reviewsLimit: preset?.reviewsPerDay ?? settings.reviewsPerDay,
		reviewedToday:
			sessionProgress?.reviewedToday ?? sessionPersistence.getReviewedToday(),
		newCardsStudiedToday,
		reviewsCompletedToday,
		newCardOrder: preset?.newCardOrder ?? settings.newCardOrder,
		reviewOrder:
			filters.customReviewOrder ?? preset?.reviewOrder ?? settings.reviewOrder,
		newReviewMix: preset?.newReviewMix ?? settings.newReviewMix,
		dayStartHour: settings.dayStartHour,
		sourceUidFilter: filters.sourceUidFilter
			? new Set([filters.sourceUidFilter])
			: undefined,
		sourceNoteFilter: filters.sourceNoteFilter,
		sourceNoteFilters: filters.sourceNoteFilters,
		filePathFilter: filters.filePathFilter,
		createdTodayOnly: filters.createdTodayOnly,
		createdThisWeek: filters.createdThisWeek,
		weakCardsOnly: filters.weakCardsOnly,
		stateFilter: filters.stateFilter,
		ignoreDailyLimits: filters.ignoreDailyLimits,
		bypassScheduling: filters.bypassScheduling,
		difficultyRange: filters.difficultyRange,
		lapsesRange: filters.lapsesRange,
		stabilityRange: filters.stabilityRange,
		overdueOnly: filters.overdueOnly,
		recentlyFailed: filters.recentlyFailed,
		cardLimit: filters.cardLimit,
		studyAheadDays: filters.studyAheadDays,
		burySiblings: preset?.burySiblings,
		customStudy,
		forgottenCardIds,
		materializedCardIds: filters.materializedCardIds,
		temporaryDeckCardIds,
		rMode: resolveRModeOptions(
			filters.schedulingMode === "retrievability" ? settings.rMode : undefined,
			preset?.requestRetention ?? settings.fsrsRequestRetention,
			filters.rModeTargetCount,
		),
		topUp: filters.topUp,
	};
}

export function isGlobalReviewSession(filters: SessionFilters): boolean {
	return !(
		filters.projectPath ||
		filters.sourceUidFilter ||
		filters.sourceNoteFilter ||
		(filters.sourceNoteFilters && filters.sourceNoteFilters.length > 0) ||
		filters.filePathFilter ||
		filters.createdTodayOnly ||
		filters.createdThisWeek ||
		filters.weakCardsOnly ||
		filters.stateFilter ||
		filters.ignoreDailyLimits ||
		filters.bypassScheduling ||
		filters.difficultyRange ||
		filters.lapsesRange ||
		filters.stabilityRange ||
		filters.overdueOnly ||
		filters.recentlyFailed ||
		filters.cardLimit ||
		filters.studyAheadDays ||
		filters.customReviewOrder ||
		filters.crammingMode ||
		filters.customStudy ||
		filters.materializedCardIds ||
		filters.temporaryDeckId
	);
}

export function buildGlobalPresetQueueContext(
	cards: CardSchedulingMeta[],
	presetService: PresetServiceLike,
	sessionPersistence: SessionPersistenceService,
	sessionProgress?: SessionProgressSnapshot,
): GlobalPresetQueueContext {
	const defaultPreset = presetService.getDefaultPreset();
	const presetDailyLimits = new Map<
		string,
		{
			newCardsPerDay: number;
			reviewsPerDay: number;
		}
	>();
	for (const preset of presetService.getPresets()) {
		presetDailyLimits.set(preset.name, {
			newCardsPerDay: preset.newCardsPerDay,
			reviewsPerDay: preset.reviewsPerDay,
		});
	}

	if (!presetDailyLimits.has(defaultPreset.name)) {
		presetDailyLimits.set(defaultPreset.name, {
			newCardsPerDay: defaultPreset.newCardsPerDay,
			reviewsPerDay: defaultPreset.reviewsPerDay,
		});
	}

	const cardPresetById = new Map<string, string>();
	const presetBySourceUid = new Map<string, string>();
	for (const card of cards) {
		const sourceUid = card.sourceUid ?? "";
		let presetName: string | undefined;

		if (sourceUid) {
			presetName = presetBySourceUid.get(sourceUid);
			if (!presetName) {
				const preset = presetService.resolvePresetForCard(card);
				presetName = preset?.name ?? defaultPreset.name;
				presetBySourceUid.set(sourceUid, presetName);
			}
		} else {
			const preset = presetService.resolvePresetForCard(card);
			presetName = preset?.name ?? defaultPreset.name;
		}

		cardPresetById.set(card.id, presetName);
	}

	const presetProgressToday = new Map(
		sessionProgress?.presetProgressToday ??
			sessionPersistence.getTodayProgressByPreset(),
	);
	if (
		defaultPreset.name !== "Default" &&
		presetProgressToday.has("Default") &&
		!presetProgressToday.has(defaultPreset.name)
	) {
		const legacyDefaultProgress = presetProgressToday.get("Default");
		if (legacyDefaultProgress) {
			presetProgressToday.set(defaultPreset.name, legacyDefaultProgress);
		}
	}

	return {
		cardPresetById,
		presetDailyLimits,
		presetProgressToday,
		defaultPresetName: defaultPreset.name,
	};
}

export function matchesSessionFilters(
	card: CardSchedulingMeta,
	filters: SessionFilters,
): boolean {
	const now = Date.now();
	const dayStartHour = filters.dayStartHour ?? 4;
	const todayBoundary = getTodayBoundary(dayStartHour).getTime();
	const weekAgoBoundary = todayBoundary - 7 * MS_PER_DAY;

	if (card.fsrs.suspended) return false;

	const buriedUntil = card.fsrs.buriedUntil
		? new Date(card.fsrs.buriedUntil).getTime()
		: null;
	if (filters.stateFilter === "buried") {
		if (!buriedUntil || buriedUntil <= now) return false;
	} else if (buriedUntil && buriedUntil > now) {
		return false;
	}

	if (filters.sourceUidFilter && card.sourceUid !== filters.sourceUidFilter) {
		return false;
	}

	if (
		filters.sourceNoteFilters &&
		filters.sourceNoteFilters.length > 0 &&
		!filters.sourceNoteFilters.includes(card.sourceNoteName ?? "")
	) {
		return false;
	}

	if (
		filters.sourceNoteFilter &&
		card.sourceNoteName !== filters.sourceNoteFilter
	) {
		return false;
	}

	if (
		filters.filePathFilter &&
		card.sourceNotePath !== filters.filePathFilter
	) {
		return false;
	}

	const createdAt = card.fsrs.createdAt ?? 0;
	if (filters.createdTodayOnly && createdAt < todayBoundary) {
		return false;
	}
	if (filters.createdThisWeek && createdAt < weekAgoBoundary) {
		return false;
	}

	if (
		filters.weakCardsOnly &&
		card.fsrs.stability >= WEAK_CARD_STABILITY_THRESHOLD
	) {
		return false;
	}

	if (filters.stateFilter) {
		switch (filters.stateFilter) {
			case "new":
				if (card.fsrs.state !== State.New) return false;
				break;
			case "learning":
				if (!isLearningState(card.fsrs.state)) {
					return false;
				}
				break;
			case "due":
				if (card.fsrs.state !== State.Review) return false;
				break;
		}
	}

	if (filters.difficultyRange) {
		if (
			card.fsrs.difficulty < filters.difficultyRange.min ||
			card.fsrs.difficulty > filters.difficultyRange.max
		) {
			return false;
		}
	}

	if (filters.lapsesRange) {
		if (
			card.fsrs.lapses < filters.lapsesRange.min ||
			card.fsrs.lapses > filters.lapsesRange.max
		) {
			return false;
		}
	}

	if (filters.stabilityRange) {
		if (
			card.fsrs.stability < filters.stabilityRange.min ||
			card.fsrs.stability > filters.stabilityRange.max
		) {
			return false;
		}
	}

	if (filters.overdueOnly) {
		if (card.fsrs.state === State.New) return false;
		if (new Date(card.fsrs.due).getTime() > now) return false;
	}

	if (filters.recentlyFailed) {
		const history = card.fsrs.history;
		if (!history || history.length === 0) return false;
		if (history[history.length - 1]?.r !== Rating.Again) return false;
	}

	if (filters.studyAheadDays !== undefined && filters.studyAheadDays > 0) {
		if (card.fsrs.state === State.Review) {
			const cutoff = now + filters.studyAheadDays * MS_PER_DAY;
			if (new Date(card.fsrs.due).getTime() > cutoff) return false;
		}
	}

	return true;
}
