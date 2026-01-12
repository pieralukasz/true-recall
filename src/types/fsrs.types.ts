/**
 * FSRS Types for Episteme
 * Typy do integracji z ts-fsrs dla natywnego systemu SRS
 */

import type { State, Rating, Card, Grade } from "ts-fsrs";

// Re-export ts-fsrs types for convenience
export { State, Rating, Grade };
export type { Card as FSRSCard };

/**
 * Single review log entry stored per-card for FSRS optimization
 * Compact format: ~50 bytes per entry
 */
export interface CardReviewLogEntry {
    /** Timestamp of review (Unix ms) */
    t: number;
    /** Rating: 1=Again, 2=Hard, 3=Good, 4=Easy */
    r: Grade;
    /** Scheduled days at time of review */
    s: number;
    /** Elapsed days since last review */
    e: number;
}

/**
 * Metadane FSRS przechowywane w SQLite
 * Tabela: cards w .episteme/episteme.db
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
    /** Czy karta jest zawieszona (nie pojawia się w review) */
    suspended?: boolean;
    /** Data do której karta jest buried (ISO string) - automatycznie odblokuje się po tej dacie */
    buriedUntil?: string;
    /** Review history for FSRS optimization (last 20 reviews, optional) */
    history?: CardReviewLogEntry[];
    /** Timestamp utworzenia karty (Unix ms, opcjonalny dla kompatybilności wstecznej) */
    createdAt?: number;

    // === Nowe pola dla SQL-based storage (schema v2) ===

    /** Pytanie fiszki (Markdown) - przechowywane w SQL */
    question?: string;
    /** Odpowiedź fiszki (Markdown) - przechowywane w SQL */
    answer?: string;
    /** UID notatki źródłowej (8-char hex) - powiązanie z notatką MD */
    sourceUid?: string;
    /** Nazwa notatki źródłowej (z JOIN source_notes) */
    sourceNoteName?: string;
    /** Tagi fiszki (JSON array) */
    tags?: string[];
}

/**
 * Informacje o notatce źródłowej
 * Przechowywane w tabeli source_notes
 */
export interface SourceNoteInfo {
    /** Unikalny identyfikator (8-char hex, równy flashcard_uid w notatce) */
    uid: string;
    /** Nazwa notatki (basename bez rozszerzenia) */
    noteName: string;
    /** Ścieżka do pliku notatki (może się zmienić przy rename) */
    notePath?: string;
    /** Domyślny deck dla fiszek z tej notatki */
    deck: string;
    /** Timestamp utworzenia */
    createdAt?: number;
    /** Timestamp ostatniej aktualizacji */
    updatedAt?: number;
}

/**
 * Rozszerzona fiszka z danymi FSRS
 * Używana w UI (ReviewView, FlashcardPanel)
 */
export interface FSRSFlashcardItem {
    /** Unikalny ID (z FSRSCardData) */
    id: string;
    /** Pytanie */
    question: string;
    /** Odpowiedź */
    answer: string;
    /** Ścieżka do pliku z fiszką. Pusty string "" gdy fiszka jest tylko w SQL (bez pliku MD) */
    filePath: string;
    /** Dane FSRS */
    fsrs: FSRSCardData;
    /** Nazwa decka (z frontmatter lub domyślna) */
    deck: string;
    /** Nazwa oryginalnej notatki źródłowej (z frontmatter source_link) */
    sourceNoteName?: string;
    /** UID notatki źródłowej (dla powiązania z notatką MD) */
    sourceUid?: string;
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
 * Persistent daily statistics stored in .episteme/stats.json
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

// ===== Statistics Panel Types =====

/**
 * Extended daily stats with rating breakdown for statistics panel
 */
export interface ExtendedDailyStats extends PersistentDailyStats {
    /** Again rating count */
    again: number;
    /** Hard rating count */
    hard: number;
    /** Good rating count */
    good: number;
    /** Easy rating count */
    easy: number;
    /** New cards reviewed (state was New) */
    newCards: number;
    /** Learning/relearning cards reviewed */
    learningCards: number;
    /** Review cards studied */
    reviewCards: number;
}

/**
 * Card maturity breakdown for pie chart
 * Young: Review cards with interval < 21 days
 * Mature: Review cards with interval >= 21 days
 */
export interface CardMaturityBreakdown {
    new: number;
    learning: number;
    young: number;
    mature: number;
    suspended: number;
    buried: number;
}

/**
 * Future due prediction entry for bar chart
 */
export interface FutureDueEntry {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Cards due on this date */
    count: number;
    /** Cumulative backlog up to this date */
    cumulative: number;
}

/**
 * Time range for statistics charts
 */
export type StatsTimeRange = "backlog" | "1m" | "3m" | "1y" | "all";

/**
 * Retention rate entry for retention chart
 */
export interface RetentionEntry {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Retention rate 0-100% */
    retention: number;
    /** Total reviews that day */
    total: number;
}

/**
 * Today summary for statistics panel
 */
export interface TodaySummary {
    /** Total cards studied */
    studied: number;
    /** Time spent in minutes */
    minutes: number;
    /** New cards studied */
    newCards: number;
    /** Review cards studied */
    reviewCards: number;
    /** Again count */
    again: number;
    /** Correct rate (good+easy / total) */
    correctRate: number;
}

/**
 * Streak information
 */
export interface StreakInfo {
    /** Current streak in days */
    current: number;
    /** Longest streak in days */
    longest: number;
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
        createdAt: Date.now(),
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

    /** Merge with data from disk (for sync conflict resolution) */
    mergeFromDisk(): Promise<{ merged: number; conflicts: number }>;

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
