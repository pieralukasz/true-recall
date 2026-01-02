import type { ShadowAnkiSettings } from "./types/settings.types";

// ===== View Types =====

/** View type identifier for the sidebar panel */
export const VIEW_TYPE_FLASHCARD_PANEL = "shadow-anki-flashcard-panel";

/** View type identifier for the review session */
export const VIEW_TYPE_REVIEW = "shadow-anki-review";

/** View type identifier for the statistics panel */
export const VIEW_TYPE_STATS = "shadow-anki-stats";

// ===== AI Models =====

/** AI Models available via OpenRouter */
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
export const DEFAULT_SETTINGS: ShadowAnkiSettings = {
	// AI Generation
	openRouterApiKey: "",
	aiModel: "google/gemini-3-flash-preview" as AIModelKey,
	flashcardsFolder: "Flashcards",
	storeSourceContent: true, // Włączone dla lepszego diff

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
	showProgress: true,
	showReviewHeader: true,
	showReviewHeaderStats: true,
};

// ===== FSRS Default Weights =====

/**
 * Domyślne wagi FSRS v5 (19 parametrów)
 * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */
export const DEFAULT_FSRS_WEIGHTS = [
	0.40255, // w0: initial stability for Again
	1.18385, // w1: initial stability for Hard
	3.173, // w2: initial stability for Good
	15.69105, // w3: initial stability for Easy
	7.1949, // w4: difficulty at first review
	0.5345, // w5: difficulty change factor
	1.4604, // w6: difficulty change rate
	0.0046, // w7: mean reversion
	1.54575, // w8: recall stability increase
	0.1192, // w9: stability exponent
	1.01925, // w10: retrievability factor
	1.9395, // w11: forget stability base
	0.11, // w12: difficulty factor for forget
	0.29605, // w13: stability factor for forget
	2.2698, // w14: retrievability factor for forget
	0.2315, // w15: hard penalty
	2.9898, // w16: easy bonus
	0.51655, // w17: short-term stability factor
	0.6621, // w18: short-term stability offset
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
	maxTitleLength: 30,
	animationDuration: 150, // ms
	debounceDelay: 300, // ms
} as const;

// ===== Flashcard Configuration =====

/** Flashcard file naming and format constants */
export const FLASHCARD_CONFIG = {
	filePrefix: "flashcards_",
	defaultFolder: "Flashcards",
	tag: "#flashcard",
	sourceContentStartMarker: "<!-- SOURCE_NOTE_CONTENT",
	sourceContentEndMarker: "END_SOURCE_NOTE_CONTENT -->",
	fsrsDataPrefix: "<!--fsrs:",
	fsrsDataSuffix: "-->",
	reviewHistoryFile: ".review-history.json",
} as const;

// ===== FSRS Configuration =====

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

/** OpenRouter API endpoint */
export const OPENROUTER_API_URL =
	"https://openrouter.ai/api/v1/chat/completions";
