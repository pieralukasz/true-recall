import type {
	PresetDailyProgress,
	SessionPersistenceService,
} from "@features/core/persistence/session-persistence.service";
import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { QueueBuildOptions } from "@features/study/services/review.service";
import type { SessionFilters } from "@features/study/ui/review/review.types";
import type { CardMutation } from "@shared/services/signals";
import type { ReviewApi } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import type { FSRSPreset, TrueRecallSettings } from "@shared/types/settings.types";

export interface CardFilterOptions {
	stateFilter?: "due" | "learning" | "new" | "buried";
	archivedSourceUids?: Set<string>;
}

interface PresetServiceLike {
	getPresets(): FSRSPreset[];
	getDefaultPreset(): FSRSPreset;
	resolvePresetForCard(card: FSRSFlashcardItem): FSRSPreset;
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
	cards: FSRSFlashcardItem[],
	options: CardFilterOptions = {},
): FSRSFlashcardItem[] {
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
		reviewOrder: filters.customReviewOrder ?? preset?.reviewOrder ?? settings.reviewOrder,
		newReviewMix: preset?.newReviewMix ?? settings.newReviewMix,
		dayStartHour: settings.dayStartHour,
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
	};
}

export function isGlobalReviewSession(filters: SessionFilters): boolean {
	return !(
		filters.projectPath ||
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
	cards: FSRSFlashcardItem[],
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
	for (const card of cards) {
		const preset = presetService.resolvePresetForCard(card);
		cardPresetById.set(card.id, preset?.name ?? defaultPreset.name);
	}

	const presetProgressToday = new Map(sessionPersistence.getTodayProgressByPreset());
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

export function applyMutation(
	m: CardMutation,
	review: ReviewApi,
	flashcardManager: FlashcardManager,
	cardStore: SqliteStoreService,
	filters: SessionFilters,
): void {
	switch (m.type) {
		case "removed": {
			if (m.cardId) {
				const queue = review.queue;
				if (queue.find((c) => c.id === m.cardId)) {
					review.removeCardById(m.cardId);
				}
			}
			if (m.cardIds && m.cardIds.length > 1) {
				const queueIds = new Set(review.queue.map((c) => c.id));
				const idsToRemove = m.cardIds.filter((id) => queueIds.has(id));
				if (idsToRemove.length > 0) {
					review.removeCardsByIds(idsToRemove);
				}
			}
			break;
		}
		case "updated": {
			if (!m.changes?.question && !m.changes?.answer) return;
			const currentCard = review.getCurrentCard();
			if (currentCard && m.cardId && currentCard.id === m.cardId) {
				const updatedData = cardStore.get(m.cardId);
				if (updatedData) {
					review.updateCurrentCardContent(
						updatedData.question ?? currentCard.question,
						updatedData.answer ?? currentCard.answer,
					);
				}
			}
			break;
		}
		case "bulk": {
			if (m.action !== "removed" || !m.cardIds) return;
			const queueIds = new Set(review.queue.map((c) => c.id));
			const idsToRemove = m.cardIds.filter((id) => queueIds.has(id));
			if (idsToRemove.length > 0) {
				review.removeCardsByIds(idsToRemove);
			}
			break;
		}
		case "added": {
			if (!m.cardId) return;
			const cards = flashcardManager.getCardsByIds([m.cardId]);
			const newCard = cards[0];
			if (!newCard) return;

			if (
				filters.sourceNoteFilter &&
				newCard.sourceNoteName !== filters.sourceNoteFilter
			) {
				return;
			}
			if (filters.sourceNoteFilters && filters.sourceNoteFilters.length > 0) {
				if (!filters.sourceNoteFilters.includes(newCard.sourceNoteName ?? "")) {
					return;
				}
			}

			review.addCardToQueue(newCard);
			break;
		}
	}
}
