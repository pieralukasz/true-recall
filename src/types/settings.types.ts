/**
 * Plugin settings types
 */

import type { AIModelKey } from "../constants";
import type { ReviewViewMode } from "./fsrs.types";

/**
 * Ustawienia pluginu Shadow Anki
 */
export interface ShadowAnkiSettings {
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

    // ===== FSRS Parameters (17 weights) =====
    /** Wagi FSRS (null = domyślne, lub tablica 17 liczb po optymalizacji) */
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
    /** Pokaż pasek postępu w sesji nauki */
    showProgress: boolean;
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
export function extractFSRSSettings(settings: ShadowAnkiSettings): FSRSSettings {
    return {
        requestRetention: settings.fsrsRequestRetention,
        maximumInterval: settings.fsrsMaximumInterval,
        weights: settings.fsrsWeights,
        learningSteps: settings.learningSteps,
        relearningSteps: settings.relearningSteps,
        enableShortTerm: true, // Zawsze włączone dla obsługi learning steps
    };
}
