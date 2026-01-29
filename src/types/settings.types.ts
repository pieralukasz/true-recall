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
 * Refine preset for AI flashcard refinement
 */
export interface RefinePreset {
    /** Unique identifier (UUID for custom, static string for defaults) */
    id: string;
    /** Display label shown in dropdown */
    label: string;
    /** Instruction text sent to AI */
    instruction: string;
    /** Whether this is a built-in default preset (not editable/deletable) */
    isDefault?: boolean;
}

/**
 * Ustawienia pluginu True Recall
 */
export interface TrueRecallSettings {
    // ===== AI Generation Settings =====
    /** Klucz API OpenRouter */
    openRouterApiKey: string;
    /** Model AI do generowania fiszek */
    aiModel: AIModelKey;

    // ===== Custom Prompts =====
    /** Custom system prompt for flashcard generation (empty = use default SYSTEM_PROMPT) */
    customGeneratePrompt: string;

    // ===== AI Refine Presets =====
    /** User's custom refine presets (defaults are in constants.ts) */
    customRefinePresets: RefinePreset[];

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

    // ===== Flashcard Collection Settings =====
    /** Remove flashcard content from markdown after collecting (default: false = keep content, only remove tag) */
    removeFlashcardContentAfterCollect: boolean;

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
    /** Template file path for creating zettels from flashcards (empty = use default) */
    zettelTemplatePath: string;

    // ===== Folder Exclusions =====
    /** Foldery wykluczone z wyszukiwania notatek bez fiszek */
    excludedFolders: string[];

    // ===== Floating Generate Button =====
    /** Enable floating button for generate from selection */
    floatingButtonEnabled: boolean;
    /** Minimum selection length to show floating button (chars) */
    floatingButtonMinChars: number;
    /** Skip preview modal and generate directly */
    floatingButtonDirectGenerate: boolean;

    // ===== Backup Settings =====
    /** Automatic backup on plugin load */
    autoBackupOnLoad: boolean;
    /** Maximum number of backups to keep (0 = unlimited) */
    maxBackups: number;
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
export function extractFSRSSettings(settings: TrueRecallSettings): FSRSSettings {
    return {
        requestRetention: settings.fsrsRequestRetention,
        maximumInterval: settings.fsrsMaximumInterval,
        weights: settings.fsrsWeights,
        learningSteps: settings.learningSteps,
        relearningSteps: settings.relearningSteps,
        enableShortTerm: true, // Zawsze włączone dla obsługi learning steps
    };
}
