import type { FSRSCardData } from "./card.types";
/**
 * @deprecated Define a minimal structural type instead.
 * Kept for backward compatibility with old src/ path aliases.
 */
export interface CardStore {
    isReady(): boolean;
    get(cardId: string): FSRSCardData | undefined;
    set(cardId: string, data: FSRSCardData): void;
    delete(cardId: string): void;
    has(cardId: string): boolean;
    keys(): string[];
    getAll(): FSRSCardData[];
    size(): number;
    load(): Promise<void>;
    flush(): Promise<void>;
    saveNow(): Promise<boolean>;
    hasAnyCardContent?(): boolean;
    getCardsWithContent?(): FSRSCardData[];
    updateCardContent?(cardId: string, question: string, answer: string): void;
    getCardsBySourceUid?(sourceUid: string): FSRSCardData[];
}
