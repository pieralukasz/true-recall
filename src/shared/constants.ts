import type {
	FSRSPreset,
	TrueRecallSettings,
} from "@shared/types/settings.types";

export const VIEW_TYPE_FLASHCARD_PANEL = "true-recall-flashcard-panel";
export const VIEW_TYPE_REVIEW = "true-recall-review";
export const VIEW_TYPE_SIMULATOR = "true-recall-simulator";
export const VIEW_TYPE_DASHBOARD = "true-recall-dashboard-view";
export const VIEW_TYPE_CARD_BROWSER = "true-recall-card-browser";
export const VIEW_TYPE_STATS = "true-recall-stats";

export interface AIModelInfo {
	name: string;
	provider: "Google" | "OpenAI" | "Anthropic" | "Meta" | "DeepSeek" | "xAI";
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
	"google/gemini-3.1-pro-preview": {
		name: "Gemini 3.1 Pro",
		provider: "Google",
		description: "Top Google reasoning model",
	},
	"google/gemini-2.5-pro-preview": {
		name: "Gemini 2.5 Pro",
		provider: "Google",
		description: "High quality reasoning",
	},
	"google/gemini-3.1-flash-lite-preview": {
		name: "Gemini 3.1 Flash Lite",
		provider: "Google",
		description: "Cheapest commercial, ultra fast",
	},
	"google/gemini-2.5-flash": {
		name: "Gemini 2.5 Flash",
		provider: "Google",
		description: "Sweet spot for production",
	},
	"google/gemma-3n-e4b-it": {
		name: "Gemma 3n E4B",
		provider: "Google",
		description: "Record-low cost, $0.03/1M tokens",
	},
	"google/gemma-3-27b-it": {
		name: "Gemma 3 27B",
		provider: "Google",
		description: "Free on OpenRouter",
	},
	"openai/gpt-5.1": {
		name: "GPT-5.1",
		provider: "OpenAI",
		description: "Latest OpenAI model",
	},
	"openai/gpt-4.1-mini": {
		name: "GPT-4.1 mini",
		provider: "OpenAI",
		description: "Solid, good for code",
	},
	"openai/gpt-5-mini": {
		name: "GPT-5 Mini",
		provider: "OpenAI",
		description: "New mini, better than 4.1 mini",
	},
	"openai/gpt-oss-20b": {
		name: "GPT-oss-20b",
		provider: "OpenAI",
		description: "Open source MoE, ultra cheap",
	},
	"anthropic/claude-sonnet-4.6": {
		name: "Claude Sonnet 4.6",
		provider: "Anthropic",
		description: "Best price/performance, agentic",
	},
	"anthropic/claude-sonnet-4.5": {
		name: "Claude Sonnet 4.5",
		provider: "Anthropic",
		description: "Previous Sonnet generation",
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
	"anthropic/claude-haiku-4.5": {
		name: "Claude Haiku 4.5",
		provider: "Anthropic",
		description: "Cheapest Claude",
	},
	"meta-llama/llama-4-maverick": {
		name: "Llama 4 Maverick",
		provider: "Meta",
		description: "Open source, better than Scout",
	},
	"meta-llama/llama-4-scout-17b-16e-instruct": {
		name: "Llama 4 Scout",
		provider: "Meta",
		description: "Cheapest open source, 10M context",
	},
	"meta-llama/llama-3.3-70b-instruct": {
		name: "Llama 3.3 70B",
		provider: "Meta",
		description: "Free on OpenRouter",
	},
	"deepseek/deepseek-chat": {
		name: "DeepSeek V3",
		provider: "DeepSeek",
		description: "Ultra cheap, high quality",
	},
	"deepseek/deepseek-v3.2": {
		name: "DeepSeek V3.2",
		provider: "DeepSeek",
		description: "90% cache discount, best value",
	},
	"deepseek/deepseek-r1": {
		name: "DeepSeek R1",
		provider: "DeepSeek",
		description: "Reasoning model, free tier available",
	},
	"x-ai/grok-4.1-fast": {
		name: "Grok 4.1 Fast",
		provider: "xAI",
		description: "2M context, agentic",
	},
} as const;

// Legacy format for backward compatibility
export const AI_MODELS = {
	"google/gemini-3-flash-preview": "Gemini 3 Flash (Google)",
	"google/gemini-3.1-pro-preview": "Gemini 3.1 Pro (Google)",
	"google/gemini-2.5-pro-preview": "Gemini 2.5 Pro (Google)",
	"google/gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite (Google)",
	"google/gemini-2.5-flash": "Gemini 2.5 Flash (Google)",
	"google/gemma-3n-e4b-it": "Gemma 3n E4B (Google)",
	"google/gemma-3-27b-it": "Gemma 3 27B (Google)",
	"openai/gpt-5.1": "GPT-5.1 (OpenAI)",
	"openai/gpt-4.1-mini": "GPT-4.1 mini (OpenAI)",
	"openai/gpt-5-mini": "GPT-5 Mini (OpenAI)",
	"openai/gpt-oss-20b": "GPT-oss-20b (OpenAI)",
	"anthropic/claude-sonnet-4.6": "Claude Sonnet 4.6 (Anthropic)",
	"anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5 (Anthropic)",
	"anthropic/claude-opus-4.5": "Claude Opus 4.5 (Anthropic)",
	"anthropic/claude-sonnet-4": "Claude Sonnet 4 (Anthropic)",
	"anthropic/claude-haiku-4.5": "Claude Haiku 4.5 (Anthropic)",
	"meta-llama/llama-4-maverick": "Llama 4 Maverick (Meta)",
	"meta-llama/llama-4-scout-17b-16e-instruct": "Llama 4 Scout (Meta)",
	"meta-llama/llama-3.3-70b-instruct": "Llama 3.3 70B (Meta)",
	"deepseek/deepseek-chat": "DeepSeek V3 (DeepSeek)",
	"deepseek/deepseek-v3.2": "DeepSeek V3.2 (DeepSeek)",
	"deepseek/deepseek-r1": "DeepSeek R1 (DeepSeek)",
	"x-ai/grok-4.1-fast": "Grok 4.1 Fast (xAI)",
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
	leechThreshold: 8,
	leechAction: "tag-only",
	newCardOrder: "random",
	reviewOrder: "due-date",
	newReviewMix: "mix-with-reviews",
};

export const DEFAULT_SETTINGS: TrueRecallSettings = {
	openRouterApiKey: "",
	aiModel: "google/gemini-3-flash-preview" as AIModelKey,
	generationLanguage: "auto",
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
	ignoreDailyLimitsForNoteStudy: true,

	removeFlashcardContentAfterCollect: false, // keep flashcard lines in note after collecting

	newCardOrder: "random",
	reviewOrder: "due-date",
	newReviewMix: "mix-with-reviews",

	dayStartHour: 4, // 4 AM like Anki - new day starts at this hour

	autoBackupOnLoad: false,
	maxBackups: 10,

	periodicBackupEnabled: true,
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

	showLinkStatusIndicators: true,

	showStatusBarWidget: true,
	showQuickReviewInPanel: true,
	defaultTypeInMode: "off",

	selectionToolbarEnabled: true,
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
	alwaysTypeInTag: "true-recall/type-in",
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

export const GITHUB_RELEASES_API =
	"https://api.github.com/repos/pieralukasz/true-recall/releases/latest";

// Cloud sync - coming soon
export const TRUE_RECALL_CLOUD = {
	supabaseUrl: process.env.SUPABASE_URL ?? "",
	supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
} as const;

// Managed AI proxy (LiteLLM) for subscription users
export const LITELLM_PROXY_URL =
	"https://ai.truerecall.app/v1/chat/completions";
export const SUBSCRIPTION_STATUS_URL =
	"https://www.truerecall.app/api/subscription/status";
export const TRUERECALL_WEB_URL = "https://www.truerecall.app";
export const TRUERECALL_BMC_URL = "https://buymeacoffee.com/pieralukasz";
export const TRUERECALL_GITHUB_URL =
	"https://github.com/pieralukasz/true-recall";
