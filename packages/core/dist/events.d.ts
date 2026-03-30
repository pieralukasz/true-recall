/**
 * Simple event emitter for card change notifications.
 * Platform-agnostic replacement for @preact/signals-based notifyCardChange.
 */
export interface CardMutation {
    type: "added" | "updated" | "removed" | "reviewed" | "bulk";
    cardId?: string;
    cardIds?: string[];
    changes?: {
        question?: boolean;
        answer?: boolean;
        fsrs?: boolean;
        suspended?: boolean;
        buried?: boolean;
        sourceUid?: boolean;
    };
    action?: string;
    sourceNoteName?: string;
    rating?: number;
    newState?: number;
}
export type CardChangeListener = (mutation: CardMutation) => void;
export declare function notifyCardChange(mutation: CardMutation): void;
export declare function onCardChange(listener: CardChangeListener): () => void;
