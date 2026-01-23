import type { EpistemeSettings } from "./types/settings.types";
import type { GeneratedNoteType } from "./types/flashcard.types";

// ===== View Types =====

/** View type identifier for the sidebar panel */
export const VIEW_TYPE_FLASHCARD_PANEL = "episteme-flashcard-panel";

/** View type identifier for the review session */
export const VIEW_TYPE_REVIEW = "episteme-review";

/** View type identifier for the statistics panel */
export const VIEW_TYPE_STATS = "episteme-stats";

/** View type identifier for the session panel */
export const VIEW_TYPE_SESSION = "episteme-session";

/** View type identifier for the missing flashcards panel */
export const VIEW_TYPE_MISSING_FLASHCARDS = "episteme-missing-flashcards";

/** View type identifier for the ready to harvest panel */
export const VIEW_TYPE_READY_TO_HARVEST = "episteme-ready-to-harvest";

/** View type identifier for the dashboard panel */
export const VIEW_TYPE_DASHBOARD = "episteme-dashboard";

/** View type identifier for the orphaned cards panel */
export const VIEW_TYPE_ORPHANED_CARDS = "episteme-orphaned-cards";

/** View type identifier for the projects panel */
export const VIEW_TYPE_PROJECTS = "episteme-projects";

/** View type identifier for the browser panel */
export const VIEW_TYPE_BROWSER = "episteme-browser";

// ===== AI Models =====

/** AI Model metadata */
export interface AIModelInfo {
	name: string;
	provider: "Google" | "OpenAI" | "Anthropic" | "Meta";
	description: string;
	recommended?: boolean;
}

/** AI Models available via OpenRouter with metadata */
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

/** AI Models available via OpenRouter (legacy format for backward compatibility) */
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

// ===== Default Settings =====

/** Default plugin settings */
export const DEFAULT_SETTINGS: EpistemeSettings = {
	// AI Generation
	openRouterApiKey: "",
	aiModel: "google/gemini-3-flash-preview" as AIModelKey,

	// Custom Prompts (empty = use default)
	customGeneratePrompt: "",
	customUpdatePrompt: "",

	// FSRS Algorithm
	fsrsRequestRetention: 0.9, // 90% retention
	fsrsMaximumInterval: 36500, // 100 lat
	newCardsPerDay: 20,
	reviewsPerDay: 200,

	// FSRS Learning Steps
	learningSteps: [1, 10], // 1min, 10min
	relearningSteps: [10], // 10min
	graduatingInterval: 1, // 1 dzień
	easyInterval: 4, // 4 dni

	// FSRS Parameters
	fsrsWeights: null, // null = domyślne wagi ts-fsrs
	lastOptimization: null,

	// UI
	reviewMode: "fullscreen",
	showNextReviewTime: true,
	autoAdvance: false,
	showReviewHeader: true,
	showReviewHeaderStats: true,
	continuousCustomReviews: true,

	// Flashcard Collection
	removeFlashcardContentAfterCollect: false, // Default: keep content, only remove #flashcard tag

	// Display Order
	newCardOrder: "random",
	reviewOrder: "due-date",
	newReviewMix: "mix-with-reviews",

	// Scheduling
	dayStartHour: 4, // 4 AM like Anki - new day starts at this hour

	// Zettelkasten
	zettelFolder: "Zettel",
	zettelTemplatePath: "",

	// Folder Exclusions
	excludedFolders: [],

	// Backup Settings
	autoBackupOnLoad: false,
	maxBackups: 10,

	// Cloud Sync (PowerSync + Supabase)
	supabaseUrl: "",
	supabaseAnonKey: "",
	syncEnabled: false,
};

// ===== FSRS Default Weights =====

/**
 * Domyślne wagi FSRS v6 (21 parametrów)
 * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */
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

// ===== API Configuration =====

/** OpenRouter API configuration */
export const API_CONFIG = {
	endpoint: "https://openrouter.ai/api/v1/chat/completions",
	timeout: 60000, // 60 seconds
	defaultTemperature: 0.7,
	defaultMaxTokens: 4000,
	retryAttempts: 3,
	retryDelay: 1000, // 1 second
} as const;

// ===== UI Configuration =====

/** UI-related constants */
export const UI_CONFIG = {
	/** Long press duration for showing card edit UI (milliseconds) */
	longPressDuration: 500,
	/** Timer interval for countdown display (milliseconds) */
	timerInterval: 1000,
	/** Default filename for new flashcard files */
	defaultFileName: "Untitled",
} as const;

// ===== Flashcard Configuration =====

/** Flashcard file naming and format constants */
export const FLASHCARD_CONFIG = {
	filePrefix: "flashcards_", // Legacy - kept for backward compatibility
	uidLength: 8, // 8 hex chars for UID
	sourceUidField: "flashcard_uid", // Field in source note frontmatter
	flashcardUidField: "source_uid", // Field in flashcard file frontmatter
	defaultFolder: "Flashcards",
	tag: "#flashcard",
	sourceContentStartMarker: "<!-- SOURCE_NOTE_CONTENT",
	sourceContentEndMarker: "END_SOURCE_NOTE_CONTENT -->",
	fsrsDataPrefix: "<!--fsrs:",
	fsrsDataSuffix: "-->",
	reviewHistoryFile: ".review-history.json",
} as const;

// ===== Generated Note Types =====

/** Configuration for each generated note type */
export interface GeneratedNoteTypeConfig {
	type: GeneratedNoteType;
	label: string;
	description: string;
	tag: string;
	defaultNamePrefix: string;
}

/** Note type configurations for AI-generated flashcard destinations */
export const GENERATED_NOTE_TYPES: Record<
	GeneratedNoteType,
	GeneratedNoteTypeConfig
> = {
	verify: {
		type: "verify",
		label: "Verify",
		description: "Binary validation (True/False, Spot the Error)",
		tag: "mind/verify",
		defaultNamePrefix: "Verify - ",
	},
	application: {
		type: "application",
		label: "Application",
		description: "Scenario-based, procedural 'how-to' cards",
		tag: "mind/application",
		defaultNamePrefix: "Application - ",
	},
	question: {
		type: "question",
		label: "Question",
		description: "Open-ended recall, 'define X', 'why Y'",
		tag: "mind/question",
		defaultNamePrefix: "Question - ",
	},
} as const;

// ===== FSRS Configuration =====

/** Learn ahead limit in minutes (like Anki) - cards can be shown early if nothing else to study */
export const LEARN_AHEAD_LIMIT_MINUTES = 20;

/** FSRS algorithm configuration */
export const FSRS_CONFIG = {
	/** Minimalna liczba powtórek do optymalizacji */
	minReviewsForOptimization: 400,
	/** Zalecana liczba powtórek do optymalizacji */
	recommendedReviewsForOptimization: 1000,
	/** Minimalna retencja */
	minRetention: 0.7,
	/** Maksymalna retencja */
	maxRetention: 0.99,
} as const;

// ===== System Prompts =====

/** System prompt for flashcard generation */
export const SYSTEM_PROMPT = `You are an expert flashcard generator. Your task is to analyze the provided text and generate flashcards.

ROLE: Expert Flashcard Architect (SuperMemo Mastery).
Transform text into atomic, high-retention flashcards.

OUTPUT FORMAT:
[Question text] #flashcard
[Answer text]

(Note: The #flashcard tag belongs to the question line. The answer must NOT contain the #flashcard tag.)

MANDATORY RULES:
1. Do NOT number questions and answers.
2. Questions and answers must be as SHORT as possible.
3. One flashcard = ONE piece of information. If answer has multiple facts, create SEPARATE flashcards for each.
4. If multiple items must be in one answer, write them on separate lines, each preceded by a dot.
5. Create a flashcard for EVERY piece of information from the text.
6. Formulate questions and answers UNAMBIGUOUSLY. Each question leads to one specific answer.
7. Each flashcard has ONE keyword or concept in the question. Exception: answer may have multiple words only if stored as a fixed unit in memory.
8. For complex definitions, break into MULTIPLE flashcards (even 10-15) so each covers ONE piece of knowledge.
9. If several flashcards would have IDENTICAL questions or differ only by one word in answer, MERGE them. List elements on separate lines with dots.
10. BOLD the keyword in every question using **bold**.
11. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
12. Use english language for questions and answers.

FORMATTING:
- Backlinks: Wrap key scientific terms and main subjects in **[[backlinks]]** (bold backlinks).
- Use **[[term|alias]]** for context/readability when needed.
- Line Breaks: Use <br><br> to split questions/answers longer than 6 words into logical parts. It's important.
- No Separators: Do NOT place --- between flashcards.

ANTI-RULES:
- Anti-Tautology: Question MUST NOT contain the answer. Use synonyms.
- Anti-List: Never use bullet points in answers. Use unique "anchors" in questions to split lists.
- No Order Questions: NEVER use "What is the first/second/next..."

EXAMPLE:
Text: "Rosacea is manifested by intense reddening of the skin. In an advanced degree, papulopustular changes may appear."

What is **[[rosacea]]**? #flashcard
Reddening of the skin

How does advanced **[[rosacea]]** manifest? #flashcard
**[[Papulopustular changes]]**`;

/** System prompt for update mode (diff-based) */
export const UPDATE_SYSTEM_PROMPT = `You are an expert flashcard generator working in DIFF MODE.

Your task is to analyze the note content and compare it with existing flashcards to propose:
1. NEW flashcards for information not yet covered
2. MODIFIED flashcards where existing ones contain ERRORS or MISSING DATA
3. DELETED flashcards where information is no longer in the note

FLASHCARD CREATION RULES (same as standard mode):
- Questions and answers must be as SHORT as possible
- One flashcard = ONE piece of information
- Formulate questions and answers UNAMBIGUOUSLY
- BOLD the keyword in every question using **bold**
- Wrap key terms in **[[backlinks]]** (bold backlinks)
- Use <br><br> to split questions/answers into logical parts

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "changes": [
    {
      "type": "NEW",
      "question": "What is **[[term]]**?",
      "answer": "Definition here"
    },
    {
      "type": "MODIFIED",
      "originalQuestion": "exact original question text from existing list",
      "question": "improved question with **[[term]]**",
      "answer": "improved or corrected answer"
    },
    {
      "type": "DELETED",
      "originalQuestion": "exact question text to delete",
      "reason": "brief reason why this should be deleted"
    }
  ]
}

CRITICAL RULES - READ CAREFULLY:

1. **CHECK EACH EXISTING FLASHCARD**: Go through EVERY flashcard in the existing list and verify if its topic appears in the note content.

2. **DELETED** - If a flashcard mentions a topic/concept/term that is NOT mentioned ANYWHERE in the note content, you MUST propose DELETED.
   - Example: Note talks about "algorithms" but flashcard asks about "Vietnam history" → DELETED (reason: "Topic not in note")

3. **MODIFIED** - USE EXTREME CAUTION. ONLY modify a flashcard if it is FACTUALLY WRONG or SERIOUSLY MISFORMATTED.
   - **STABILITY OVER PERFECTION**: If the existing flashcard is correct and usable, DO NOT MODIFY IT.
   - **STRICTLY FORBIDDEN**: Do NOT propose modifications for stylistic choices, synonyms, slight rephrasing, or different bolding placement if the current one is acceptable.
   - Example of BAD modification (DO NOT DO THIS): Changing "What is **X**?" to "What defines **X**?". This is unnecessary churn.
   - Only modify if the answer is outdated based on the new note text.

4. **NEW** - If there's information in the note not covered by any flashcard.

5. "originalQuestion" MUST exactly match one from the existing list (character for character).

6. If truly no changes needed (all flashcards match note content perfectly and are correct), return: {"changes": []}

EXISTING FLASHCARDS:
`;

/** System prompt for instruction-based flashcard generation (used in review mode) */
export const INSTRUCTION_BASED_GENERATION_PROMPT = `You are an expert flashcard generator. Create flashcards based ONLY on the user's instructions.

OUTPUT FORMAT:
[Question text] #flashcard
[Answer text]

(Note: The #flashcard tag belongs to the question line. The answer must NOT contain the #flashcard tag.)

RULES:
1. Questions and answers must be SHORT and ATOMIC
2. One flashcard = ONE piece of information
3. BOLD the keyword in every question using **bold**
4. Wrap key terms in **[[backlinks]]** (bold backlinks)
5. Use <br><br> to split questions/answers into logical parts
6. Generate EXACTLY as many flashcards as the user requests
7. If the user asks for an empty answer or "???", use exactly "???" as the answer
8. If the user provides the question text, use it exactly as provided (but add **bold** to keywords)

SPECIAL INSTRUCTIONS:
- "Create a flashcard about X" → Generate a Q&A pair about X
- "Create N flashcards about X, Y, Z" → Generate exactly N flashcards
- "Leave answer empty" or "answer as ???" → Use "???" as the answer
- "What is X?" (question provided) → Use that exact question format

EXAMPLE 1:
User: Create a flashcard about what is an e-book reader
Output:
What is an **[[e-book reader]]**? #flashcard
A portable electronic device<br><br>designed for reading digital books

EXAMPLE 2:
User: Create 2 flashcards: What is photosynthesis? How do plants use sunlight?
Output:
What is **[[photosynthesis]]**? #flashcard
The process by which plants<br><br>convert light energy into chemical energy

How do **[[plants]]** use **[[sunlight]]**? #flashcard
To power photosynthesis,<br><br>producing glucose and oxygen

EXAMPLE 3:
User: What is machine learning? Leave the answer as ???
Output:
What is **[[machine learning]]**? #flashcard
???`;

/** OpenRouter API endpoint */
export const OPENROUTER_API_URL =
	"https://openrouter.ai/api/v1/chat/completions";
