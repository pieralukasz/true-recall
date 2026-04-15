import type { FSRSPreset, TrueRecallSettings } from "./types/settings.types";

export const ENABLE_RAG = true;

export const VIEW_TYPE_FLASHCARD_PANEL = "true-recall-flashcard-panel";
export const VIEW_TYPE_REVIEW = "true-recall-review";
export const VIEW_TYPE_SIMULATOR = "true-recall-simulator";
export const VIEW_TYPE_DASHBOARD = "true-recall-dashboard-view";
export const VIEW_TYPE_CARD_BROWSER = "true-recall-card-browser";
export const VIEW_TYPE_STATS = "true-recall-stats";
export const UNASSIGNED_PATH = "__unassigned__";

export interface ByokModelConfig {
	id: string;
	name: string;
	provider: string;
	description: string;
	defaultTemperature: number;
	recommended?: boolean;
}

export const BYOK_MODELS: ByokModelConfig[] = [
	{
		id: "google/gemini-2.5-pro-preview",
		name: "Gemini 2.5 Pro",
		provider: "Google",
		description: "Best thinking model, 1M context",
		defaultTemperature: 0.7,
	},
	{
		id: "google/gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		provider: "Google",
		description: "Fast + cheap thinking",
		defaultTemperature: 0.7,
		recommended: true,
	},
	{
		id: "deepseek/deepseek-r1",
		name: "DeepSeek R1",
		provider: "DeepSeek",
		description: "Open source reasoning, free tier",
		defaultTemperature: 0.6,
	},
	{
		id: "anthropic/claude-sonnet-4",
		name: "Claude Sonnet 4",
		provider: "Anthropic",
		description: "Extended thinking",
		defaultTemperature: 1.0,
	},
	{
		id: "openai/o4-mini",
		name: "o4-mini",
		provider: "OpenAI",
		description: "Reasoning, affordable",
		defaultTemperature: 1.0,
	},
];

export const CUSTOM_MODEL_ID = "__custom__";

export const DEFAULT_BYOK_MODEL = "google/gemini-2.5-flash";

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

export const TTS_VOICES = [
	"alloy",
	"echo",
	"fable",
	"onyx",
	"nova",
	"shimmer",
] as const;
export type TTSVoice = (typeof TTS_VOICES)[number];

export const DEFAULT_SETTINGS: TrueRecallSettings = {
	enableDeviceSync: false,
	openRouterApiKey: "",
	aiModel: DEFAULT_BYOK_MODEL,
	aiTier: "byok",
	generationLanguage: "auto",
	generationNoteTypeId: null,
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

	reviewKeybindings: {
		revealAndGood: " ",
		again: "1",
		hard: "2",
		easy: "4",
	},

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
	showDonutsInPanel: true,
	showDonutsInReview: true,

	showStatusBarWidget: true,
	defaultTypeInMode: "off",
	noteReviewShowFrontmatter: false,

	selectionToolbarEnabled: true,

	editorToolbarButtons: [
		{ id: "flashcards", enabled: true },
		{ id: "vocab", enabled: true },
		{ id: "io", enabled: true },
		{ id: "edit", enabled: true },
		{ id: "quick-add", enabled: true },
		{ id: "highlight", enabled: true },
		{ id: "copy", enabled: true },
		{ id: "new-note", enabled: true },
	],
	globalToolbarButtons: [
		{ id: "flashcards", enabled: true },
		{ id: "vocab", enabled: true },
		{ id: "edit", enabled: true },
		{ id: "quick-add", enabled: true },
		{ id: "copy", enabled: true },
		{ id: "new-note", enabled: true },
		{ id: "append", enabled: true },
	],

	enableLocalApi: false,
	apiPort: 27182,

	ragEnabled: false,
	ragEmbeddingModel: "baai/bge-m3",
	ragIncludeFolders: [],
	ragExcludeFolders: [".true-recall", "templates"],
	ragIndexFlashcards: true,
	ragAutoIndex: true,
	ragChunkMaxTokens: 400,
	ragDailyNotesFolder: "",
	ragDailyNoteExcludeHeadings: ["Thoughts", "Journal", "Reflections", "Random"],

	ragChatConfig: {
		presetId: "default",
		customInstruction: "",
		responseLength: "medium",
	},

	languageNoteTypeId: null,
	languageSource: "",
	languageTarget: "",
	languageTtsField: "",
	languageTtsEnabled: false,
	ttsVoice: "nova",
	ttsAutoplay: true,
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

export const MS_PER_DAY = 86_400_000;

export const WEAK_CARD_STABILITY_THRESHOLD = 7; // days

export const REQUEUE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const RANDOM_QUEUE_INSERT_MAX_POS = 5;

export const CARD_HISTORY_LIMIT = 20;

export const GITHUB_RELEASES_API =
	"https://api.github.com/repos/pieralukasz/true-recall/releases/latest";

export const LITELLM_URL = "https://ai.truerecall.app/v1/chat/completions";
export const LITELLM_EMBEDDINGS_URL = "https://ai.truerecall.app/v1/embeddings";
export const OPENROUTER_EMBEDDINGS_URL =
	"https://openrouter.ai/api/v1/embeddings";

export const VIEW_TYPE_KNOWLEDGE_CHAT = "true-recall-knowledge-chat";

export const RAG_FREE_NOTE_LIMIT = 100;

export const RAG_CONFIG = {
	embeddingBatchSize: 64,
	indexDebounceMs: 5000,
	rrf_k: 60,
	defaultTopK: 10,
	embeddingDims: 1024,
	cosineThreshold: 0.35,
} as const;

export const TRUERECALL_WEB_URL = "https://truerecall.app";
export const TRUERECALL_BMC_URL = "https://www.buymeacoffee.com/1Hzbip1K9Q";
export const TRUERECALL_GITHUB_URL =
	"https://github.com/pieralukasz/true-recall";
export const TRUERECALL_DISCORD_URL = "https://discord.gg/Zp5wGupP4b";
