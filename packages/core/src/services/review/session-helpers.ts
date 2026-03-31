import { WEAK_CARD_STABILITY_THRESHOLD } from "@true-recall/core/constants";
import type {
	PresetDailyProgress,
	SessionPersistenceService,
} from "@true-recall/core/persistence/session/session-persistence.service";
import type { QueueBuildOptions } from "@true-recall/core/services/review/review.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";
import { getTodayBoundary } from "@true-recall/core/utils/date.utils";
import { Rating, State } from "ts-fsrs";

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
		// Skip archived source notes always
		if (archivedSourceUids?.has(card.sourceUid ?? "")) return false;

		// Skip suspended cards always
		if (card.fsrs.suspended) return false;

		// If reviewing buried cards, ONLY include buried
		if (stateFilter === "buried") {
			if (!card.fsrs.buriedUntil) return false;
			return new Date(card.fsrs.buriedUntil) > now;
		}

		// Normal mode: exclude buried cards
		if (card.fsrs.buriedUntil) {
			const buriedUntil = new Date(card.fsrs.buriedUntil);
			if (buriedUntil > now) return false;
		}

		return true;
	});
}

export function getEmptyQueueMessage(stateFilter?: string): string {
	if (stateFilter === "buried") {
		return "No buried cards found.";
	}

	return "Congratulations! No cards due for review.";
}

export function buildQueueOptions(
	filters: SessionFilters,
	settings: TrueRecallSettings,
	sessionPersistence: SessionPersistenceService,
	preset?: FSRSPreset,
): QueueBuildOptions {
	return {
		newCardsLimit: preset?.newCardsPerDay ?? settings.newCardsPerDay,
		reviewsLimit: preset?.reviewsPerDay ?? settings.reviewsPerDay,
		reviewedToday: sessionPersistence.getReviewedToday(),
		newCardsStudiedToday: sessionPersistence.getNewCardsStudiedToday(),
		reviewsCompletedToday: sessionPersistence.getReviewCardsCompletedToday(),
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
		filters.crammingMode
	);
}

export function buildGlobalPresetQueueContext(
	cards: CardSchedulingMeta[],
	presetService: PresetServiceLike,
	sessionPersistence: SessionPersistenceService,
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
	const weekAgoBoundary = todayBoundary - 7 * 86_400_000;

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
				if (
					card.fsrs.state !== State.Learning &&
					card.fsrs.state !== State.Relearning
				) {
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
			const cutoff = now + filters.studyAheadDays * 86_400_000;
			if (new Date(card.fsrs.due).getTime() > cutoff) return false;
		}
	}

	return true;
}
