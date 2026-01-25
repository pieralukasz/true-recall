/**
 * FSRS Store Types
 * CardStore interface for storage implementations
 */

import type { FSRSCardData } from "./card.types";

/**
 * Common interface for card storage services
 */
export interface CardStore {
    /** Check if store is loaded and ready */
    isReady(): boolean;

    /** Get a card by ID */
    get(cardId: string): FSRSCardData | undefined;

    /** Set/update a card */
    set(cardId: string, data: FSRSCardData): void;

    /** Delete a card */
    delete(cardId: string): void;

    /** Check if a card exists */
    has(cardId: string): boolean;

    /** Get all card IDs */
    keys(): string[];

    /** Get all cards */
    getAll(): FSRSCardData[];

    /** Get total card count */
    size(): number;

    /** Load store from disk */
    load(): Promise<void>;

    /** Flush pending changes to disk */
    flush(): Promise<void>;

    /** Force immediate save */
    saveNow(): Promise<void>;

    // === Schema v2 methods (optional - for SQL storage) ===

    /** Check if any cards have content (question/answer) stored in SQL */
    hasAnyCardContent?(): boolean;

    /** Get all cards that have content stored in SQL */
    getCardsWithContent?(): FSRSCardData[];

    /** Update only card content without touching FSRS data */
    updateCardContent?(cardId: string, question: string, answer: string): void;

    /** Get cards by source note UID */
    getCardsBySourceUid?(sourceUid: string): FSRSCardData[];
}
