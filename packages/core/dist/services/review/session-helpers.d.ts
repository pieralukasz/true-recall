import type { PresetDailyProgress, SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type { QueueBuildOptions } from "@true-recall/core/services/review/review.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";
import type { FSRSPreset, TrueRecallSettings } from "@true-recall/core/types/settings.types";
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
    presetDailyLimits: Map<string, {
        newCardsPerDay: number;
        reviewsPerDay: number;
    }>;
    presetProgressToday: Map<string, PresetDailyProgress>;
    defaultPresetName: string;
}
/**
 * Returns active (non-suspended, non-buried, non-archived) cards, or specifically
 * buried cards if stateFilter is "buried"
 */
export declare function filterActiveCards(cards: CardSchedulingMeta[], options?: CardFilterOptions): CardSchedulingMeta[];
export declare function getEmptyQueueMessage(stateFilter?: string): string;
export declare function buildQueueOptions(filters: SessionFilters, settings: TrueRecallSettings, sessionPersistence: SessionPersistenceService, preset?: FSRSPreset): QueueBuildOptions;
export declare function isGlobalReviewSession(filters: SessionFilters): boolean;
export declare function buildGlobalPresetQueueContext(cards: CardSchedulingMeta[], presetService: PresetServiceLike, sessionPersistence: SessionPersistenceService): GlobalPresetQueueContext;
export declare function matchesSessionFilters(card: CardSchedulingMeta, filters: SessionFilters): boolean;
export {};
