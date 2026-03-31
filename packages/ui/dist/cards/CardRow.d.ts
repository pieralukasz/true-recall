import type { BrowserCard, ColumnDef } from "./types";
interface CardRowProps {
    card: BrowserCard;
    columns: ColumnDef[];
    gridTemplate: string;
    top: number;
    selected: boolean;
    previewing: boolean;
    onSelect: (cardId: string, event?: {
        shiftKey?: boolean;
        ctrlKey?: boolean;
        metaKey?: boolean;
    }) => void;
    onPreview: (card: BrowserCard) => void;
}
export declare function CardRow({ card, columns, gridTemplate, top, selected, previewing, onSelect, onPreview, }: CardRowProps): import("preact").JSX.Element;
export {};
