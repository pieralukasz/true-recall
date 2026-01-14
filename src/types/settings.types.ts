/**
 * Plugin settings types
 */

import type { AIModelKey } from "../constants";
import type { ReviewViewMode } from "./fsrs";

/**
 * Display order for new cards
 */
export type NewCardOrder = "random" | "oldest-first" | "newest-first";

/**
 * Display order for review cards
 */
export type ReviewOrder = "due-date" | "random" | "due-date-random";

/**
 * How to mix new cards with reviews
 */
export type NewReviewMix = "show-after-reviews" | "mix-with-reviews" | "show-before-reviews";

/**
 * Ustawienia pluginu Episteme
 */
export interface EpistemeSettings {
    // ===== AI Generation Settings =====
    /** Klucz API OpenRouter */
    openRouterApiKey: string;
    /** Model AI do generowania fiszek */
    aiModel: AIModelKey;
    /** Folder na pliki fiszek */
    flashcardsFolder: string;
    /** Zapisuj treść źródłową notatki w pliku fiszek */
    storeSourceContent: boolean;

    // ===== FSRS Algorithm Settings =====
    /** Docelowa retencja (0.7-0.99, domyślnie 0.9 = 90%) */
    fsrsRequestRetention: number;
    /** Maksymalny interwał w dniach (domyślnie 36500 = 100 lat) */
    fsrsMaximumInterval: number;
    /** Limit nowych kart dziennie */
    newCardsPerDay: number;
    /** Limit powtórek dziennie */
    reviewsPerDay: number;

    // ===== FSRS Learning Steps =====
    /** Kroki nauki w minutach (np. [1, 10] = 1min, 10min) */
    learningSteps: number[];
    /** Kroki ponownej nauki w minutach (np. [10]) */
    relearningSteps: number[];
    /** Interwał po ukończeniu nauki w dniach (domyślnie 1) */
    graduatingInterval: number;
    /** Interwał dla "Easy" w dniach (domyślnie 4) */
    easyInterval: number;

    // ===== FSRS Parameters (21 weights for v6) =====
    /** Wagi FSRS (null = domyślne v6, lub tablica 17/19/21 liczb po optymalizacji) */
    fsrsWeights: number[] | null;
    /** Data ostatniej optymalizacji (ISO string lub null) */
    lastOptimization: string | null;

    // ===== UI Settings =====
    /** Tryb wyświetlania Review View */
    reviewMode: ReviewViewMode;
    /** Pokaż przewidywany czas przy przyciskach odpowiedzi */
    showNextReviewTime: boolean;
    /** Automatycznie przejdź do następnej karty po odpowiedzi */
    autoAdvance: boolean;
    /** Pokaż nagłówek w sesji Review */
    showReviewHeader: boolean;
    /** Pokaż statystyki new/learning/due w nagłówku Review */
    showReviewHeaderStats: boolean;
    /** Pokaż przycisk "Next Session" po zakończeniu sesji niestandardowej */
    continuousCustomReviews: boolean;

    // ===== Display Order Settings =====
    /** Kolejność nowych kart */
    newCardOrder: NewCardOrder;
    /** Kolejność kart do powtórki */
    reviewOrder: ReviewOrder;
    /** Jak mieszać nowe karty z powtórkami */
    newReviewMix: NewReviewMix;

    // ===== Scheduling Settings =====
    /** Godzina rozpoczęcia nowego dnia (0-23, domyślnie 4 = 4:00 AM jak w Anki) */
    dayStartHour: number;

    // ===== Zettelkasten Settings =====
    /** Folder na notatki zettelkasten tworzone z fiszek */
    zettelFolder: string;
}

/**
 * Ustawienia FSRS (podzbiór do przekazania do serwisu)
 */
export interface FSRSSettings {
    requestRetention: number;
    maximumInterval: number;
    weights: number[] | null;
    learningSteps: number[];
    relearningSteps: number[];
    enableShortTerm: boolean;
}

/**
 * Wyciąga ustawienia FSRS z głównych ustawień
 */
export function extractFSRSSettings(settings: EpistemeSettings): FSRSSettings {
    return {
        requestRetention: settings.fsrsRequestRetention,
        maximumInterval: settings.fsrsMaximumInterval,
        weights: settings.fsrsWeights,
        learningSteps: settings.learningSteps,
        relearningSteps: settings.relearningSteps,
        enableShortTerm: true, // Zawsze włączone dla obsługi learning steps
    };
}
