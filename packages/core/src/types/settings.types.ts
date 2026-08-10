/**
 * Plugin settings types
 */

import type { CardAIUserSettings } from "./card-ai-preset.types";
import type { ReviewViewMode } from "./fsrs";
import type { GenerationPreset } from "./generation-preset.types";
import type { TemporaryCustomStudyDeck } from "./review-session.types";

export type AITier = "pro" | "byok" | "custom" | "lmstudio";

/** AI provider type — determines which endpoint and auth to use. */
export type AIProviderType = "pro" | "openrouter" | "custom" | "lmstudio";

export interface ToolbarButtonConfig {
	id: string;
	enabled: boolean;
}

/** A saved quick instruction ("chip") for the AI assistant prompt. */
export interface AssistantPreset {
	id: string;
	name: string;
	instruction: string;
}

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
 * Maximum content width preset for the review session.
 */
export type ReviewContentWidth = "narrow" | "default" | "wide" | "full";

/**
 * Display order for review cards
 */
export type ReviewOrder =
	| "due-date"
	| "random"
	| "due-date-random"
	| "by-retrievability"
	| "most-lapses"
	| "relative-overdueness"
	| "lowest-stability"
	| "order-added";

/**
 * How to mix new cards with reviews
 */
export type NewReviewMix =
	| "show-after-reviews"
	| "mix-with-reviews"
	| "show-before-reviews";

export type TypeInMode = "off" | "ai" | "diff";

/**
 * Named group of FSRS scheduling parameters (like Anki's "Deck Options").
 * Each preset defines retention target, weights, learning steps, and daily limits.
 * Notes reference presets by name via frontmatter `fsrs_preset` field.
 */
/**
 * Leech action when a card exceeds the lapse threshold
 */
export type LeechAction = "suspend" | "tag-only";

export interface FSRSPreset {
	id: string;
	name: string;
	requestRetention: number;
	maximumInterval: number;
	weights: number[] | null;
	enableFuzz?: boolean;
	learningSteps: number[];
	relearningSteps: number[];
	newCardsPerDay: number;
	reviewsPerDay: number;
	createdAt: number;
	lastOptimization: string | null;
	lastOptimizationReviewCount: number | null;
	lastOptimizationMetrics: OptimizationMetrics | null;

	// Leech detection (Anki-style)
	leechThreshold?: number;
	leechAction?: LeechAction;

	// Per-preset display order (moved from global settings)
	newCardOrder?: NewCardOrder;
	reviewOrder?: ReviewOrder;
	newReviewMix?: NewReviewMix;

	// Sibling burying (Anki-style) — after answering an IO or cloze card,
	// bury remaining cards from the same note until next day
	burySiblings?: boolean;
}

export interface ReviewKeybindings {
	/** Key for reveal answer + Good rating (KeyboardEvent.key value) */
	revealAndGood: string;
	/** Key for Again rating */
	again: string;
	/** Key for Hard rating */
	hard: string;
	/** Key for Easy rating */
	easy: string;
}

/**
 * True Recall plugin settings
 */
/**
 * R-Mode builds sessions from continuous retrievability instead of due dates,
 * so nothing is ever overdue and the user states the session size.
 *
 * Fully reversible: the due queue and the load balancer keep running
 * underneath, so switching modes changes no card data.
 */
export interface RModeSettings {
	enabled: boolean;
	/** Session size pre-filled in the picker. */
	defaultSessionSize: number;
	/** Share of the session drawn from well-remembered cards. Clamped to 0–0.5. */
	comfortMix: number;
	/**
	 * Added to requestRetention to get the saturation ceiling. Above it a review
	 * buys almost no stability, so the card is not offered at all.
	 */
	ceilingOffset: number;
	/** Below this R a card is never displaced by the comfort quota. */
	urgentBelow: number;
}

export interface TrueRecallSettings {
	/** Device ID backup — survives reinstall via iCloud sync */
	deviceId?: string;

	/** Enable cross-device sync on plugin startup */
	enableDeviceSync: boolean;

	/** Which AI provider to use */
	providerType: AIProviderType;
	/** True Recall Pro key (LiteLLM) — only when providerType = "pro" */
	proKey?: string;
	/** OpenRouter API key — only when providerType = "openrouter" */
	openRouterApiKey: string;
	/** Selected BYOK model ID (OpenRouter) */
	aiModel: string;
	/** Custom OpenRouter model ID — used when aiModel is __custom__ */
	customAiModel?: string;
	/** Custom temperature override — when undefined, uses model's default */
	aiTemperature?: number;
	/** AI provider tier (derived from providerType) */
	aiTier: AITier;
	/** Custom provider base URL (default: http://localhost:11434/v1 for Ollama) */
	customBaseUrl: string;
	/** Custom provider API key (optional — many local setups don't need auth) */
	customApiKey?: string;
	/** Custom provider model name (free-text) */
	customModel: string;
	/** Custom provider temperature (0-2) */
	customTemperature?: number;

	/** LM Studio provider base URL (default: http://localhost:1234/v1) */
	lmStudioBaseUrl: string;
	/** LM Studio selected model ID (from auto-discovered dropdown) */
	lmStudioModel: string;
	/** LM Studio API key (optional — only needed if auth is enabled in LM Studio) */
	lmStudioApiKey?: string;
	/** LM Studio temperature override (0-2) */
	lmStudioTemperature?: number;
	/** Optional LM Studio model override for AI Flashcard Generation */
	lmStudioGenerationModel: string;
	/** Optional LM Studio model override for Card Polish */
	lmStudioCardPolishModel: string;

	/** User-created Card Polish presets (built-ins live in the plugin, not here). */
	cardPolish?: CardAIUserSettings;

	/** Target retention (0.7-0.99, default 0.9 = 90%) */
	fsrsRequestRetention: number;
	/** Maximum interval in days (default 36500 = 100 years) */
	fsrsMaximumInterval: number;
	/** Daily new cards limit */
	newCardsPerDay: number;
	/** Daily reviews limit */
	reviewsPerDay: number;

	/** Learning steps in minutes (e.g., [1, 10] = 1min, 10min) */
	learningSteps: number[];
	/** Relearning steps in minutes (e.g., [10]) */
	relearningSteps: number[];
	/** FSRS weights (null = default v6, or array of 17/19/21 numbers after optimization) */
	fsrsWeights: number[] | null;
	/** Last optimization date (ISO string or null) */
	lastOptimization: string | null;

	/** Continuous-retrievability sessions (experimental) */
	rMode: RModeSettings;

	/** Review View display mode */
	reviewMode: ReviewViewMode;
	/** Maximum content width preset for the review session (desktop only) */
	reviewContentWidth: ReviewContentWidth;
	/** Show predicted time on answer buttons */
	showNextReviewTime: boolean;
	/** Auto-advance to next card after answer */
	autoAdvance: boolean;
	/** Show header in Review session */
	showReviewHeader: boolean;
	/** Show new/learning/due stats in Review header */
	showReviewHeaderStats: boolean;
	/** Show 'Next Session' button after custom session ends */
	continuousCustomReviews: boolean;
	/** Bypass daily limits when studying a specific note from the dashboard */
	ignoreDailyLimitsForNoteStudy: boolean;
	/** Show today's summary and recently studied notes at the top of the dashboard */
	showDashboardHeader: boolean;

	/** Hide the main-window tab bar (toggled by the `toggle-tab-bar` command) */
	hideTabBar: boolean;

	/** Custom review keybindings */
	reviewKeybindings: ReviewKeybindings;

	/** Remove flashcard content from markdown after collecting (default: false = keep content, only remove tag) */
	removeFlashcardContentAfterCollect: boolean;

	/** New cards display order */
	newCardOrder: NewCardOrder;
	/** Review cards display order */
	reviewOrder: ReviewOrder;
	/** How to mix new cards with reviews */
	newReviewMix: NewReviewMix;

	/** New day start hour (0-23, default 4 = 4:00 AM like Anki) */
	dayStartHour: number;

	/** Automatic backup on plugin load */
	autoBackupOnLoad: boolean;
	/** Maximum number of backups to keep (0 = unlimited) - legacy, use retentionPolicy instead */
	maxBackups: number;

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

	/** Auto-add source note to Obsidian Copilot context during review */
	copilotAutoContext: boolean;

	/** Enable automatic load balancing when scheduling */
	loadBalanceEnabled: boolean;
	/** How the daily target is determined: suggested from recent pace or set manually */
	loadBalanceTargetMode: "auto" | "manual";
	/** Target daily review count for load balancing (manual mode only) */
	loadBalanceTarget: number;
	/** Maximum deviation from target (percentage 0-100) */
	loadBalanceMaxDeviation: number;
	/** Maximum day shift when balancing a newly scheduled review */
	loadBalanceMaxShiftDays: number;
	/** Day range for manual Balance now operations (0 = all future) */
	loadBalanceBulkDays: number;

	/** Easy days configuration (recurring weekdays + specific dates) */
	easyDays: EasyDaysConfig;
	/** Workload multiplier for easy days (0.0-1.0) */
	easyDaysMultiplier: number;

	/** Minimum days between siblings from same source note */
	siblingMinInterval: number;
	/** Enable automatic sibling dispersal on review */
	siblingDisperseEnabled: boolean;

	/** Number of reviews used in last optimization */
	lastOptimizationReviewCount: number | null;
	/** Optimization convergence metrics from last run */
	lastOptimizationMetrics: OptimizationMetrics | null;

	/** Scheduled breaks (vacations) for review redistribution */
	scheduledBreaks: ScheduledBreak[];

	/** Saved custom study session presets */
	sessionPresets: SessionPreset[];
	/** Anki-style filtered decks created by Custom Study. */
	temporaryCustomStudyDecks: TemporaryCustomStudyDeck[];
	/** @deprecated Migrated to temporaryCustomStudyDecks on load. */
	temporaryCustomStudyDeck?: TemporaryCustomStudyDeck;

	/** FSRS scheduling presets (always contains at least one "Default") */
	fsrsPresets: FSRSPreset[];
	/** ID of the default preset used as fallback */
	defaultPresetId: string;

	/** Show inline flashcard status indicators next to [[links]] in editor */
	showLinkStatusIndicators: boolean;

	/** Show donut indicators in flashcard panel card content */
	showDonutsInPanel: boolean;
	/** Show donut indicators in review card content */
	showDonutsInReview: boolean;

	/** Show status bar widget with global due/new/learning counts */
	showStatusBarWidget: boolean;

	/** Default type-in mode at the start of each review session */
	defaultTypeInMode: TypeInMode;

	/** Show YAML frontmatter in note review cards (default: false) */
	noteReviewShowFrontmatter: boolean;

	/** Button configuration for the editor (CodeMirror) selection toolbar */
	editorToolbarButtons: ToolbarButtonConfig[];
	/** Button configuration for the global (non-editor) selection toolbar */
	globalToolbarButtons: ToolbarButtonConfig[];
	/** Button configuration for the image-click toolbar */
	imageToolbarButtons: ToolbarButtonConfig[];

	/** AI Assistant: model override for the assistant scope ("" = inherit aiModel) */
	assistantModel: string;
	/** AI Assistant: enable OpenRouter web search on assistant requests */
	assistantWebSearch: boolean;
	/** AI Assistant: global instructions appended to every task's system prompt */
	assistantInstructions: string;
	/** AI Assistant: saved quick-instruction chips */
	assistantPresets: AssistantPreset[];
	/** AI Assistant: max agent loop iterations per task */
	assistantMaxIterations: number;
	/** AI Assistant: max web sources/citations to collect per task */
	assistantMaxSources: number;

	/** Custom generation prompt — appended to both Pro and BYOK system prompts */
	aiGenerationPrompt?: string;

	/** Language for AI-generated flashcards ("auto" = match source text) */
	generationLanguage?: string;
	/** Note type used for AI generation (null = Basic) */
	generationNoteTypeId: string | null;
	/** Custom system prompt for AI semantic grading in review type-in mode */
	aiTypeInGradingPrompt?: string;
	/** Custom user prompt for AI image occlusion region detection */
	aiIODetectionPrompt?: string;

	/** Language learning: note type for vocab generation (null = use generationNoteTypeId) */
	languageNoteTypeId: string | null;
	/** Language learning: source language code (language being learned) */
	languageSource: string;
	/** Language learning: target language code (your native language) */
	languageTarget: string;

	/** Last version the user has seen release notes for */
	lastSeenVersion?: string;

	/** Enable local HTTP API for CLI integration */
	enableLocalApi: boolean;
	/** Port for local HTTP API (default 27182) */
	apiPort: number;

	/** Per-plugin enabled/disabled state (plugin ID → boolean). All enabled by default. */
	pluginStates?: Record<string, boolean>;

	/** One-time migration: cascaded archive to descendants of archived projects */
	archiveCascadeMigrated?: boolean;

	/** Generation presets for AI flashcard creation */
	generationPresets: GenerationPreset[];
	/** ID of the default generation preset */
	defaultGenerationPresetId: string;

	/**
	 * Overrides where True Recall writes binary attachments: pasted images,
	 * Image Occlusion crops, and Anki import media.
	 * Empty string = each feature keeps its own pre-existing fallback behavior.
	 */
	attachmentFolder: string;
	/**
	 * Pre-fills the notes-destination folder field in the Anki import modal.
	 * Empty string = modal keeps its built-in "Anki Import" default.
	 */
	defaultAnkiImportFolder: string;
	/**
	 * Pre-fills the folder field when creating a new top-level project note.
	 * Empty string = vault root.
	 */
	defaultProjectFolder: string;
}

export interface SessionPreset {
	id: string;
	name: string;
	createdAt: number;
	stateFilter?: "due" | "learning" | "new" | "buried";
	difficultyRange?: { min: number; max: number };
	lapsesRange?: { min: number; max: number };
	stabilityRange?: { min: number; max: number };
	overdueOnly?: boolean;
	recentlyFailed?: boolean;
	reviewOrder?: ReviewOrder;
	cardLimit?: number;
	studyAheadDays?: number;
	crammingMode?: boolean;
}

/**
 * FSRS settings (subset to pass to service)
 */
export interface FSRSSettings {
	requestRetention: number;
	maximumInterval: number;
	weights: number[] | null;
	enableFuzz: boolean;
	learningSteps: number[];
	relearningSteps: number[];
	enableShortTerm: boolean;
}

/**
 * Extracts FSRS settings from main settings (uses default preset if available,
 * falls back to legacy global fields for backward compatibility)
 */
export function extractFSRSSettings(
	settings: TrueRecallSettings,
): FSRSSettings {
	const defaultPreset = settings.fsrsPresets?.find(
		(p) => p.id === settings.defaultPresetId,
	);
	if (defaultPreset) {
		return extractFSRSSettingsFromPreset(defaultPreset);
	}
	return {
		requestRetention: settings.fsrsRequestRetention,
		maximumInterval: settings.fsrsMaximumInterval,
		weights: settings.fsrsWeights,
		enableFuzz: true,
		learningSteps: settings.learningSteps,
		relearningSteps: settings.relearningSteps,
		enableShortTerm: true,
	};
}

export function extractFSRSSettingsFromPreset(
	preset: FSRSPreset,
): FSRSSettings {
	return {
		requestRetention: preset.requestRetention,
		maximumInterval: preset.maximumInterval,
		weights: preset.weights,
		enableFuzz: preset.enableFuzz !== false,
		learningSteps: preset.learningSteps,
		relearningSteps: preset.relearningSteps,
		enableShortTerm: true,
	};
}
