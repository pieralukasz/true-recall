import type { ReviewLogForSync } from "@true-recall/core/persistence/sqlite/modules/StatsActions";
import type { FSRSCardData } from "@true-recall/core/types";
interface DeckInfo {
    id: number;
    name: string;
}
interface BuildOptions {
    cards: FSRSCardData[];
    reviewLogs: ReviewLogForSync[];
    deckMap: Map<string, DeckInfo>;
    collectionCreatedAt: number;
    includeScheduling: boolean;
    media: Map<string, ArrayBuffer>;
}
export declare class ApkgBuilderService {
    build(options: BuildOptions): Promise<ArrayBuffer>;
    private createAnkiSchema;
    private insertCollection;
    private insertNotesAndCards;
    private insertRevlog;
    private mapFsrsToAnki;
    private resolveDeckId;
    private buildModelsJson;
    private buildDecksJson;
    private buildConfJson;
    private buildDconfJson;
    private packageAsZip;
}
export {};
