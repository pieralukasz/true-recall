/**
 * Card browser types.
 * Mirrored from src/features/library/ui/browser/types.ts
 */
import type { State } from "ts-fsrs";
export interface BrowserCard {
    id: string;
    question: string;
    answer: string;
    state: State;
    suspended: boolean;
    buriedUntil: string | null;
    reps: number;
    lapses: number;
    stability: number;
    difficulty: number;
    due: string;
    lastReview: string | null;
    sourceNoteName: string | null;
    sourceNoteUid: string | null;
    cardType: string;
    createdVia: string;
    archived: boolean;
}
export interface ColumnDef {
    key: string;
    label: string;
    width: string;
    align?: "left" | "center" | "right";
    accessor: (card: BrowserCard) => string;
}
