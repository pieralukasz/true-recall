import type { BrowserCard } from "./types";
interface CardGridProps {
    cards: BrowserCard[];
    selectedIds: Set<string>;
    onSelect: (cardId: string, event?: {
        shiftKey?: boolean;
        ctrlKey?: boolean;
        metaKey?: boolean;
    }) => void;
    onPreview: (card: BrowserCard) => void;
}
export declare function CardGrid({ cards, selectedIds, onSelect, onPreview, }: CardGridProps): import("preact").JSX.Element;
export {};
