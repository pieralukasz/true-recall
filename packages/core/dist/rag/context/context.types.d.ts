export interface NoteContextItem {
    kind: "active-note" | "manual-note";
    path: string;
    basename: string;
    sourceUid?: string;
    cardCount?: number;
    auto: boolean;
}
export interface CardContextItem {
    kind: "review-card" | "manual-card";
    cardId: string;
    question: string;
    sourceNoteName?: string;
    auto: boolean;
}
export type ContextItem = NoteContextItem | CardContextItem;
export declare function contextKey(item: ContextItem): string;
