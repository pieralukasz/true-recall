export interface FlashcardItem {
    question: string;
    answer: string;
    id: string;
}

export interface FlashcardInfo {
    exists: boolean;
    cardCount: number;
    questions: string[];
    flashcards: FlashcardItem[];
    lastModified: number | null;
    sourceUid?: string;
}
