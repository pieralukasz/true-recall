/**
 * High-performance storage for FSRS card data using sql.js.
 * Uses domain modules: store.cards.*, store.stats.*
 */
import type { IPersistence } from "../../interfaces/persistence";
import { IntegrityCheckService } from "../../services/maintenance/integrity-check.service";
import type { CardSchedulingMeta, FSRSCardData } from "../../types";
import { CardActions, NoteActions, NoteTypeActions, StatsActions } from "./modules";
import { SqliteDatabase } from "./SqliteDatabase";
export declare class SqliteStoreService {
    private static readonly FOLLOW_UP_FLUSH_MS;
    private persistence;
    private deviceId;
    private db;
    private isLoaded;
    private isDirty;
    private saveTimer;
    private flushPromise;
    private suppressRetryScheduling;
    private lastFlushStartedAt;
    private lastFlushSucceededAt;
    private lastFlushFailedAt;
    private lastFlushError;
    readonly cards: CardActions;
    readonly stats: StatsActions;
    readonly notes: NoteActions;
    readonly noteTypes: NoteTypeActions;
    readonly integrity: IntegrityCheckService;
    constructor(persistence: IPersistence, deviceId: string);
    getSqliteDb(): SqliteDatabase;
    getDeviceId(): string;
    load(): Promise<void>;
    private cleanupStaleReferences;
    private recreateTableWithFixedFk;
    isReady(): boolean;
    get(cardId: string): FSRSCardData | undefined;
    set(cardId: string, data: FSRSCardData): void;
    delete(cardId: string): void;
    has(cardId: string): boolean;
    keys(): string[];
    getAll(): FSRSCardData[];
    getAllSchedulingMeta(): CardSchedulingMeta[];
    getSchedulingMetaById(cardId: string): CardSchedulingMeta | null;
    size(): number;
    getByIds(cardIds: string[]): FSRSCardData[];
    getCardsWithContent(): FSRSCardData[];
    getCardsBySourceUid(sourceUid: string): FSRSCardData[];
    getClozeSiblings(sourceUid: string, clozeTemplate: string): FSRSCardData[];
    hasCardContent(cardId: string): boolean;
    hasAnyCardContent(): boolean;
    getCardsWithContentCount(): number;
    flush(): Promise<void>;
    private getDbPath;
    private loadFromFile;
    private markDirty;
    private scheduleSave;
    private scheduleFollowUpFlush;
    private runFlushPass;
    private doFlush;
    saveNow(options?: {
        bestEffort?: boolean;
    }): Promise<boolean>;
    close(): Promise<void>;
    transaction<T>(fn: () => T): T;
    getStats(): {
        totalCards: number;
        totalReviews: number;
        dbSizeKB: number;
        isLoaded: boolean;
    };
    getDatabase(): import("./loader").DatabaseLike;
    getCards(): FSRSCardData[];
    getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[];
    updateCardDue(cardId: string, newDue: string): void;
    updateCardScheduling(cardId: string, data: {
        due: string;
        scheduledDays: number;
    }): void;
    getReviewDataForOptimization(presetName?: string): {
        cardId: string;
        reviewedAt: number;
        rating: number;
        scheduledDays: number;
        elapsedDays: number;
        state: number;
        stability: number;
        difficulty: number;
    }[];
    getReviewsForRetention(startDate: string, endDate: string, presetNames?: string[]): {
        date: string;
        rating: number;
    }[];
    getPersistenceDebugInfo(): {
        dbPath: string;
        isDirty: boolean;
        saveTimerActive: boolean;
        flushInProgress: boolean;
        lastFlushStartedAt: number | null;
        lastFlushSucceededAt: number | null;
        lastFlushFailedAt: number | null;
        lastFlushError: string | null;
    };
}
