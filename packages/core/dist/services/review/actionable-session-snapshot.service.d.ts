import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import { type CardSchedulingMeta, type TrueRecallSettings } from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";
export interface ActionableSessionSnapshot {
    queue: CardSchedulingMeta[];
    counts: {
        new: number;
        learning: number;
        due: number;
    };
    queueLength: number;
}
/** Resolves a note name to its file path (replaces MetadataCache dependency) */
export interface INoteResolver {
    resolveNotePath(noteName: string): string | null;
}
export interface ActionableSessionSnapshotDeps {
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
export interface ActionableSessionSnapshotOptions {
    cache?: Map<string, ActionableSessionSnapshot>;
    activeCards?: CardSchedulingMeta[];
}
export declare function computeActionableSessionSnapshot(deps: ActionableSessionSnapshotDeps, filters: SessionFilters, options?: ActionableSessionSnapshotOptions): ActionableSessionSnapshot;
