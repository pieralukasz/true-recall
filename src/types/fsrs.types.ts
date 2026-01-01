/**
 * FSRS Types for Shadow Anki
 * Typy do integracji z ts-fsrs dla natywnego systemu SRS
 */

import type { State, Rating, Card, Grade } from "ts-fsrs";

// Re-export ts-fsrs types for convenience
export { State, Rating, Grade };
export type { Card as FSRSCard };

/**
 * Metadane FSRS przechowywane w pliku Markdown
 * Format: <!--fsrs:{"id":"abc123","due":"2025-01-15",...}-->
 */
export interface FSRSCardData {
    /** Unikalny ID fiszki (UUID) */
    id: string;
    /** Data następnej powtórki (ISO string) */
    due: string;
    /** Stabilność pamięci (dni) - jak długo pamiętasz */
    stability: number;
    /** Trudność karty (1-10, gdzie 1=łatwa, 10=trudna) */
    difficulty: number;
    /** Liczba powtórzeń */
    reps: number;
    /** Liczba zapomnieć (lapses) */
    lapses: number;
    /** Stan karty: 0=New, 1=Learning, 2=Review, 3=Relearning */
    state: State;
    /** Data ostatniej powtórki (ISO string lub null) */
    lastReview: string | null;
    /** Zaplanowane dni do następnej powtórki */
    scheduledDays: number;
    /** Aktualny krok nauki (dla Learning/Relearning) */
    learningStep: number;
}

/**
 * Rozszerzona fiszka z danymi FSRS
 */
export interface FSRSFlashcardItem {
    /** Unikalny ID (z FSRSCardData) */
    id: string;
    /** Pytanie */
    question: string;
    /** Odpowiedź */
    answer: string;
    /** Numer linii w pliku źródłowym */
    lineNumber: number;
    /** Ścieżka do pliku z fiszką */
    filePath: string;
    /** Dane FSRS */
    fsrs: FSRSCardData;
    /** Nazwa decka (z frontmatter lub domyślna) */
    deck: string;
}

/**
 * Wynik pojedynczej powtórki
 */
export interface ReviewResult {
    /** ID karty */
    cardId: string;
    /** Ocena: Again=1, Hard=2, Good=3, Easy=4 */
    rating: Grade;
    /** Timestamp powtórki */
    timestamp: number;
    /** Czas odpowiedzi w ms */
    responseTime: number;
    /** Stan karty przed powtórką */
    previousState: State;
    /** Zaplanowane dni (przed powtórką) */
    scheduledDays: number;
    /** Rzeczywiste dni od ostatniej powtórki */
    elapsedDays: number;
}

/**
 * Wpis historii powtórek (do optymalizacji FSRS)
 */
export interface ReviewHistoryEntry {
    cardId: string;
    rating: Grade;
    timestamp: number;
    scheduledDays: number;
    elapsedDays: number;
    state: State;
    stability: number;
    difficulty: number;
}

/**
 * Statystyki sesji nauki
 */
export interface ReviewSessionStats {
    /** Całkowita liczba kart w sesji */
    total: number;
    /** Liczba przeglądniętych kart */
    reviewed: number;
    /** Odpowiedzi "Again" */
    again: number;
    /** Odpowiedzi "Hard" */
    hard: number;
    /** Odpowiedzi "Good" */
    good: number;
    /** Odpowiedzi "Easy" */
    easy: number;
    /** Nowe karty w sesji */
    newCards: number;
    /** Karty w nauce (Learning) */
    learningCards: number;
    /** Karty do powtórki (Review) */
    reviewCards: number;
    /** Czas trwania sesji w ms */
    duration: number;
}

/**
 * Stan sesji nauki
 */
export interface ReviewSessionState {
    /** Czy sesja jest aktywna */
    isActive: boolean;
    /** Kolejka kart do nauki */
    queue: FSRSFlashcardItem[];
    /** Indeks aktualnej karty */
    currentIndex: number;
    /** Czy odpowiedź jest odkryta */
    isAnswerRevealed: boolean;
    /** Wyniki powtórek w sesji */
    results: ReviewResult[];
    /** Czas rozpoczęcia sesji */
    startTime: number;
    /** Czas odkrycia pytania (do obliczenia response time) */
    questionShownTime: number;
    /** Statystyki sesji */
    stats: ReviewSessionStats;
}

/**
 * Podgląd harmonogramu dla każdej odpowiedzi
 */
export interface SchedulingPreview {
    again: {
        due: Date;
        interval: string; // np. "<1m", "10m", "1d"
    };
    hard: {
        due: Date;
        interval: string;
    };
    good: {
        due: Date;
        interval: string;
    };
    easy: {
        due: Date;
        interval: string;
    };
}

/**
 * Wynik walidacji historii przed optymalizacją
 */
export interface HistoryValidationResult {
    isValid: boolean;
    totalReviews: number;
    totalCards: number;
    message: string;
    warnings: string[];
}

/**
 * Opcje optymalizacji parametrów FSRS
 */
export interface OptimizationOptions {
    /** Filtr wyszukiwania (np. "folder:Math") */
    searchQuery?: string;
    /** Minimalna liczba powtórek do użycia */
    minReviews?: number;
    /** Pomiń pierwsze N dni (faza nauki) */
    excludeFirstDays?: number;
}

/**
 * Wynik optymalizacji parametrów
 */
export interface OptimizationResult {
    success: boolean;
    weights: number[];
    reviewCount: number;
    message: string;
}

/**
 * Statystyki dzienne
 */
export interface DailyStats {
    /** Nowe karty przeglądnięte dzisiaj */
    newReviewed: number;
    /** Powtórki wykonane dzisiaj */
    reviewsCompleted: number;
    /** Karty zaplanowane na dziś */
    dueToday: number;
    /** Nowe karty pozostałe na dziś */
    newRemaining: number;
    /** Data (YYYY-MM-DD) */
    date: string;
}

/**
 * Persistent daily statistics stored in .shadow-anki/stats.json
 */
export interface PersistentDailyStats {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** IDs of cards reviewed today (for exclusion from queue) */
    reviewedCardIds: string[];
    /** Count of new cards studied today (for daily limit) */
    newCardsStudied: number;
    /** Total reviews completed today */
    reviewsCompleted: number;
    /** Total time spent reviewing in ms */
    totalTimeMs: number;
}

/**
 * Persistent stats file structure
 */
export interface PersistentStatsData {
    /** Schema version for migrations */
    version: number;
    /** Last update timestamp (ISO string) */
    lastUpdated: string;
    /** Daily stats keyed by date (YYYY-MM-DD) */
    daily: Record<string, PersistentDailyStats>;
}

/**
 * Deck information
 */
export interface DeckInfo {
    /** Deck name (unique identifier) */
    name: string;
    /** Number of cards in this deck */
    cardCount: number;
    /** Due cards count */
    dueCount: number;
    /** New cards count */
    newCount: number;
}

/**
 * Tryb wyświetlania Review View
 */
export type ReviewViewMode = "fullscreen" | "panel";

/**
 * Domyślne dane FSRS dla nowej karty
 */
export function createDefaultFSRSData(id: string): FSRSCardData {
    return {
        id,
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0 as State, // State.New
        lastReview: null,
        scheduledDays: 0,
        learningStep: 0,
    };
}

/**
 * Domyślny stan sesji nauki
 */
export function createDefaultSessionState(): ReviewSessionState {
    return {
        isActive: false,
        queue: [],
        currentIndex: 0,
        isAnswerRevealed: false,
        results: [],
        startTime: 0,
        questionShownTime: 0,
        stats: {
            total: 0,
            reviewed: 0,
            again: 0,
            hard: 0,
            good: 0,
            easy: 0,
            newCards: 0,
            learningCards: 0,
            reviewCards: 0,
            duration: 0,
        },
    };
}

/**
 * Formatuje interwał do czytelnej formy
 * @param minutes Liczba minut
 * @returns Sformatowany string (np. "<1m", "10m", "1d", "2mo")
 */
export function formatInterval(minutes: number): string {
    if (minutes < 1) {
        return "<1m";
    }
    if (minutes < 60) {
        return `${Math.round(minutes)}m`;
    }
    if (minutes < 60 * 24) {
        const hours = Math.round(minutes / 60);
        return `${hours}h`;
    }
    if (minutes < 60 * 24 * 30) {
        const days = Math.round(minutes / (60 * 24));
        return `${days}d`;
    }
    if (minutes < 60 * 24 * 365) {
        const months = Math.round(minutes / (60 * 24 * 30));
        return `${months}mo`;
    }
    const years = Math.round(minutes / (60 * 24 * 365));
    return `${years}y`;
}

/**
 * Formatuje interwał z dni do czytelnej formy
 */
export function formatIntervalDays(days: number): string {
    return formatInterval(days * 24 * 60);
}
