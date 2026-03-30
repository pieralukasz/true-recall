import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { AnkiCard, AnkiRevlogEntry, FSRSCardData } from "@true-recall/core/types";
export declare class AnkiSchedulingService {
    private fsrsService;
    constructor(fsrsService: FSRSService);
    replayScheduling(cardId: string, ankiCard: AnkiCard, revlogs: AnkiRevlogEntry[]): FSRSCardData;
    mapSchedulingDirect(cardId: string, ankiCard: AnkiCard): FSRSCardData;
    convert(cardId: string, ankiCard: AnkiCard, revlogs: AnkiRevlogEntry[]): FSRSCardData;
    private clampEase;
    private mapAnkiTypeToState;
    private applyStatus;
}
