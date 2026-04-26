import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { FSRSHelperService } from "@true-recall/core/metrics/fsrs-tools/fsrs-helper.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";
export declare class StudyDataGatherer {
    private cardStore;
    private fsrsHelper;
    private flashcardManager;
    private dayBoundary;
    private hierarchy;
    constructor(cardStore: SqliteStoreService, fsrsHelper: FSRSHelperService, flashcardManager: FlashcardManager, dayBoundary: DayBoundaryService, hierarchy: HierarchyService);
    gather(query: string): string | null;
    private getMatchingTopics;
    private todayTopic;
    private streakTopic;
    private retentionTopic;
    private maturityTopic;
    private workloadTopic;
    private problemsTopic;
    private patternsTopic;
    private overviewTopic;
    private getDueCount;
}
