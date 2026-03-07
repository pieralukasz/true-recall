/**
 * Plugin settings types
 */

import type { AIModelKey } from "@shared/constants";
import type { ReviewViewMode } from "@shared/types/fsrs";

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
}

/**
 * True Recall plugin settings
 */
export interface TrueRecallSettings {
	/** OpenRouter API key */
	openRouterApiKey: string;
	/** AI model for NL query */
	aiModel: AIModelKey;

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

	/** Review View display mode */
	reviewMode: ReviewViewMode;
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
	/** Target daily review count for load balancing */
	loadBalanceTarget: number;
	/** Maximum deviation from target (percentage 0-100) */
	loadBalanceMaxDeviation: number;

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

	/** FSRS scheduling presets (always contains at least one "Default") */
	fsrsPresets: FSRSPreset[];
	/** ID of the default preset used as fallback */
	defaultPresetId: string;

	/** Show inline flashcard status indicators next to [[links]] in editor */
	showLinkStatusIndicators: boolean;

	/** Show status bar widget with global due/new/learning counts */
	showStatusBarWidget: boolean;

	/** Show quick review section at top of flashcard panel */
	showQuickReviewInPanel: boolean;

	/** Default type-in mode at the start of each review session */
	defaultTypeInMode: TypeInMode;

	/** Show floating toolbar above selected text for AI flashcard generation */
	selectionToolbarEnabled: boolean;

	/** Subscription key for managed AI proxy (replaces BYOK when set) */
	subscriptionKey?: string;
	/** Cached validation result — enables instant routing on startup without async API call */
	isSubscriber?: boolean;
	/** Cached tier from last successful validation */
	subscriberTier?: string;
	/** Cached allowed models from last subscription status check */
	cachedAllowedModels?: string[];
	/** Auto-generated UUID per installation, sent with proxy requests for rate limiting */
	userId?: string;

	/** Custom prompts for AI flashcard generation (per mode) */
	aiFlashcardPrompts?: {
		basic?: string;
		cloze?: string;
		reversed?: string;
		auto?: string;
	};

	/** Language for AI-generated flashcards ("auto" = match source text) */
	generationLanguage?: string;
	/** Controls card density for whole-note generation */
	generationDensity?: "essential" | "balanced" | "comprehensive";
	/** Custom system prompt for AI semantic grading in review type-in mode */
	aiTypeInGradingPrompt?: string;
	/** Custom user prompt for AI image occlusion region detection */
	aiIODetectionPrompt?: string;
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
		learningSteps: preset.learningSteps,
		relearningSteps: preset.relearningSteps,
		enableShortTerm: true,
	};
}
