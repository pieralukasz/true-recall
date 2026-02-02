/**
 * Plugin settings types
 */

import type { AIModelKey } from "../constants";
import type { ReviewViewMode } from "./fsrs";

// ===== FSRS Helper Types =====

/**
 * Optimization result metrics from FSRS parameter optimization
 */
export interface OptimizationMetrics {
	/** Root mean square error of the optimization */
	rmse: number;
	/** Log loss of the optimization */
	logLoss: number;
	/** Number of reviews used in optimization */
	reviewCount: number;
	/** Optimization convergence status */
	convergenceStatus: "converged" | "max_iterations" | "insufficient_data";
}

// ===== Background Backup Types =====

/**
 * Backup interval options (in minutes)
 * 0 = disabled
 */
export type BackupInterval = 0 | 15 | 30 | 60 | 120 | 240;

/**
 * Multi-tier retention policy configuration
 * Similar to Time Machine - keeps recent backups densely, older ones sparsely
 */
export interface RetentionPolicy {
    /** Keep one backup per hour for the last N hours (0 = disabled) */
    hourlyBackupsToKeep: number;
    /** Keep one backup per day for the last N days (0 = disabled) */
    dailyBackupsToKeep: number;
    /** Keep one backup per week for the last N weeks (0 = disabled) */
    weeklyBackupsToKeep: number;
}

/**
 * Scheduled break period for vacation/time off
 */
export interface ScheduledBreak {
	/** Unique identifier for the break */
	id: string;
	/** Start date (ISO date string YYYY-MM-DD) */
	startDate: string;
	/** End date (ISO date string YYYY-MM-DD) */
	endDate: string;
	/** Redistribute reviews before the break */
	redistributeBefore: boolean;
	/** Redistribute reviews after the break */
	redistributeAfter: boolean;
}

/**
 * Easy Days configuration for reduced workload
 */
export interface EasyDaysConfig {
	/** Recurring days of week with reduced load (0=Sun, 1=Mon, ..., 6=Sat) */
	recurringDays: number[];
	/** Specific dates with reduced load (ISO date strings YYYY-MM-DD) */
	specificDates: string[];
}

/**
 * Display order for new cards
 */
export type NewCardOrder = "random" | "oldest-first" | "newest-first";

/**
 * Display order for review cards
 */
export type ReviewOrder = "due-date" | "random" | "due-date-random" | "by-retrievability";

/**
 * How to mix new cards with reviews
 */
export type NewReviewMix = "show-after-reviews" | "mix-with-reviews" | "show-before-reviews";

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

    // ===== Backup Settings (Legacy) =====
    /** Automatic backup on plugin load */
    autoBackupOnLoad: boolean;
    /** Maximum number of backups to keep (0 = unlimited) - legacy, use retentionPolicy instead */
    maxBackups: number;

    // ===== Background Backup Settings =====
    /** Enable periodic background backups */
    periodicBackupEnabled: boolean;
    /** Backup interval in minutes (0 = disabled) */
    backupIntervalMinutes: BackupInterval;
    /** Enable activity-based backup triggers (backup after N reviews) */
    activityTriggeredBackup: boolean;
    /** Number of reviews after which to trigger a backup */
    reviewsBeforeBackup: number;
    /** Multi-tier retention policy (hourly/daily/weekly) */
    retentionPolicy: RetentionPolicy;

    // ===== Copilot Integration =====
    /** Auto-add source note to Obsidian Copilot context during review */
    copilotAutoContext: boolean;

    // ===== Review Font Size =====
    /** Review card font size scale (0.5-2.0, default 1.0 = 100%) */
    reviewFontScale: number;

    // ===== FSRS Helper: Load Balance =====
    /** Enable automatic load balancing when scheduling */
    loadBalanceEnabled: boolean;
    /** Target daily review count for load balancing */
    loadBalanceTarget: number;
    /** Maximum deviation from target (percentage 0-100) */
    loadBalanceMaxDeviation: number;

    // ===== FSRS Helper: Easy Days =====
    /** Easy days configuration (recurring weekdays + specific dates) */
    easyDays: EasyDaysConfig;
    /** Workload multiplier for easy days (0.0-1.0) */
    easyDaysMultiplier: number;

    // ===== FSRS Helper: Sibling Disperse =====
    /** Minimum days between siblings from same source note */
    siblingMinInterval: number;
    /** Enable automatic sibling dispersal on review */
    siblingDisperseEnabled: boolean;

    // ===== FSRS Helper: Optimizer Metadata =====
    /** Number of reviews used in last optimization */
    lastOptimizationReviewCount: number | null;
    /** Optimization convergence metrics from last run */
    lastOptimizationMetrics: OptimizationMetrics | null;

    // ===== FSRS Helper: Schedule Breaks =====
    /** Scheduled breaks (vacations) for review redistribution */
    scheduledBreaks: ScheduledBreak[];
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
