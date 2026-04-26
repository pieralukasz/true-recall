import type { IPersistence } from "@true-recall/core/interfaces/persistence";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { AnkiImportOptions, AnkiImportResult, ApkgData, ConvertedCard } from "@true-recall/core/types";
import { type IVaultFileReader } from "./anki-media.service";
export interface IAnkiImportVault {
    exists(path: string): Promise<boolean>;
    ensureFolderRecursive(folderPath: string): Promise<void>;
    createFile(path: string, content: string): Promise<void>;
    readFile(path: string): Promise<string>;
    appendToFile(path: string, content: string): Promise<void>;
    prependToFile(path: string, content: string): Promise<void>;
    getFrontmatterUid(path: string): Promise<string | null>;
    addParentToFrontmatter(path: string, parentName: string): Promise<void>;
}
export type CardChangeNotifier = (change: {
    type: "bulk";
    cardIds: string[];
    action: "added";
}) => void;
export declare class AnkiImportService {
    private store;
    private fsrsService;
    private persistence;
    private vault;
    private fileReader?;
    private onCardChange?;
    constructor(store: SqliteStoreService, fsrsService: FSRSService, persistence: IPersistence, vault: IAnkiImportVault, fileReader?: IVaultFileReader | undefined, onCardChange?: CardChangeNotifier | undefined);
    static parseAndConvert(fileData: ArrayBuffer): Promise<{
        apkgData: ApkgData;
        convertedCards: ConvertedCard[];
    }>;
    importApkg(fileData: ArrayBuffer, options: AnkiImportOptions): Promise<AnkiImportResult>;
    importCards(apkgData: ApkgData, convertedCards: ConvertedCard[], options: AnkiImportOptions): Promise<AnkiImportResult>;
    private importSingleCard;
    private importReviewLogs;
    /**
     * Creates one source note per deck.
     * Leaf decks get cards linked; ancestor decks become MOC nodes in the hierarchy.
     */
    private createDeckNotes;
    private getOrCreateNote;
    private buildFrontmatter;
    private generateUid;
    private buildMinimalAnkiCard;
}
