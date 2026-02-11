import type { FSRSPreset, TrueRecallSettings } from "./types/settings.types";

export const VIEW_TYPE_FLASHCARD_PANEL = "true-recall-flashcard-panel";
export const VIEW_TYPE_REVIEW = "true-recall-review";
export const VIEW_TYPE_STATS = "true-recall-stats";
export const VIEW_TYPE_SESSION = "true-recall-session";
export const VIEW_TYPE_PROJECTS = "true-recall-projects";
export const VIEW_TYPE_SIMULATOR = "true-recall-simulator";
export const VIEW_TYPE_ORPHANED_CARDS = "true-recall-orphaned-cards";
export const VIEW_TYPE_NOTE_HUB = "true-recall-note-hub";
export const VIEW_TYPE_CARD_BROWSER = "true-recall-card-browser";

export interface AIModelInfo {
	name: string;
	provider: "Google" | "OpenAI" | "Anthropic" | "Meta";
	description: string;
	recommended?: boolean;
}

export const AI_MODELS_EXTENDED: Record<string, AIModelInfo> = {
	"google/gemini-3-flash-preview": {
		name: "Gemini 3 Flash",
		provider: "Google",
		description: "Fast, cost-effective",
		recommended: true,
	},
	"google/gemini-2.5-pro-preview": {
		name: "Gemini 2.5 Pro",
		provider: "Google",
		description: "High quality reasoning",
	},
	"openai/gpt-5.1": {
		name: "GPT-5.1",
		provider: "OpenAI",
		description: "Latest OpenAI model",
	},
	"openai/gpt-4o": {
		name: "GPT-4o",
		provider: "OpenAI",
		description: "Balanced performance",
	},
	"anthropic/claude-opus-4.5": {
		name: "Claude Opus 4.5",
		provider: "Anthropic",
		description: "Most capable",
	},
	"anthropic/claude-sonnet-4": {
		name: "Claude Sonnet 4",
		provider: "Anthropic",
		description: "Fast & smart",
	},
	"meta-llama/llama-4-maverick": {
		name: "Llama 4 Maverick",
		provider: "Meta",
		description: "Open source",
	},
} as const;

// Legacy format for backward compatibility
export const AI_MODELS = {
	"google/gemini-3-flash-preview": "Gemini 3 Flash (Google)",
	"google/gemini-2.5-pro-preview": "Gemini 2.5 Pro (Google)",
	"openai/gpt-5.1": "GPT-5.1 (OpenAI)",
	"openai/gpt-4o": "GPT-4o (OpenAI)",
	"anthropic/claude-opus-4.5": "Claude Opus 4.5 (Anthropic)",
	"anthropic/claude-sonnet-4": "Claude Sonnet 4 (Anthropic)",
	"meta-llama/llama-4-maverick": "Llama 4 Maverick (Meta)",
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

export const DEFAULT_FSRS_PRESET: FSRSPreset = {
	id: "default",
	name: "Default",
	requestRetention: 0.9,
	maximumInterval: 36500,
	weights: null,
	learningSteps: [1, 10],
	relearningSteps: [10],
	newCardsPerDay: 20,
	reviewsPerDay: 200,
	createdAt: 0,
	lastOptimization: null,
	lastOptimizationReviewCount: null,
	lastOptimizationMetrics: null,
};

export const DEFAULT_SETTINGS: TrueRecallSettings = {
	openRouterApiKey: "",
	aiModel: "google/gemini-3-flash-preview" as AIModelKey,
	fsrsRequestRetention: 0.9,
	fsrsMaximumInterval: 36500, // 100 years
	newCardsPerDay: 20,
	reviewsPerDay: 200,

	learningSteps: [1, 10], // minutes
	relearningSteps: [10], // minutes

	fsrsWeights: null, // null = use ts-fsrs defaults
	lastOptimization: null,

	reviewMode: "fullscreen",
	showNextReviewTime: true,
	autoAdvance: false,
	showReviewHeader: true,
	showReviewHeaderStats: true,
	continuousCustomReviews: true,

	removeFlashcardContentAfterCollect: false, // keep content, only remove #flashcard tag

	newCardOrder: "random",
	reviewOrder: "due-date",
	newReviewMix: "mix-with-reviews",

	dayStartHour: 4, // 4 AM like Anki - new day starts at this hour

	excludedFolders: [],

	autoBackupOnLoad: false,
	maxBackups: 10,

	periodicBackupEnabled: false,
	backupIntervalMinutes: 60,
	activityTriggeredBackup: false,
	reviewsBeforeBackup: 50,
	retentionPolicy: {
		hourlyBackupsToKeep: 24,
		dailyBackupsToKeep: 7,
		weeklyBackupsToKeep: 4,
	},

	copilotAutoContext: false,

	loadBalanceEnabled: false,
	loadBalanceTarget: 100,
	loadBalanceMaxDeviation: 20,

	easyDays: {
		recurringDays: [],
		specificDates: [],
	},
	easyDaysMultiplier: 0.5,

	siblingMinInterval: 3,
	siblingDisperseEnabled: false,

	lastOptimizationReviewCount: null,
	lastOptimizationMetrics: null,

	scheduledBreaks: [],

	sessionPresets: [],

	fsrsPresets: [DEFAULT_FSRS_PRESET],
	defaultPresetId: "default",

	projectOrder: [],
};

// FSRS v6 default weights (21 parameters)
// See: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
export const DEFAULT_FSRS_WEIGHTS = [
	0.212, // w0: initial stability for Again
	1.2931, // w1: initial stability for Hard
	2.3065, // w2: initial stability for Good
	8.2956, // w3: initial stability for Easy
	6.4133, // w4: difficulty weight
	0.8334, // w5: difficulty decay
	3.0194, // w6: difficulty base
	0.001, // w7: hard penalty
	1.8722, // w8: easy bonus
	0.1666, // w9: mean reversion weight
	0.796, // w10: recall stability weight
	1.4835, // w11: lapse stability base
	0.0614, // w12: lapse difficulty weight
	0.2629, // w13: lapse stability weight
	1.6483, // w14: lapse retrievability weight
	0.6014, // w15: hard interval modifier
	1.8729, // w16: easy interval modifier
	0.5425, // w17: short-term stability factor
	0.0912, // w18: short-term stability offset
	0.0658, // w19: same-day stability exponent
	0.1542, // w20: forgetting curve decay
] as const;

export const UI_CONFIG = {
	longPressDuration: 500, // ms, for showing card edit UI
	timerInterval: 1000, // ms
	defaultFileName: "Untitled",
} as const;

export const FLASHCARD_CONFIG = {
	sourceUidField: "flashcard_uid", // frontmatter field linking source note to cards
	tag: "#flashcard",
	reverseTag: "#flashcard-reverse",
} as const;

// Cards can be shown early if nothing else to study (like Anki)
export const LEARN_AHEAD_LIMIT_MINUTES = 20;

export const FSRS_CONFIG = {
	minReviewsForOptimization: 400,
	recommendedReviewsForOptimization: 1000,
	minRetention: 0.7,
	maxRetention: 0.99,
} as const;

export const WEAK_CARD_STABILITY_THRESHOLD = 7; // days

export const REQUEUE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const RANDOM_QUEUE_INSERT_MAX_POS = 5;

export const CARD_HISTORY_LIMIT = 20;

// Cloud sync - coming soon
export const TRUE_RECALL_CLOUD = {
	supabaseUrl: process.env.SUPABASE_URL ?? "",
	supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
} as const;
