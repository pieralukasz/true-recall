import type { TrueRecallSettings } from "./types/settings.types";
import type { GeneratedNoteType } from "./types/flashcard.types";

export const VIEW_TYPE_FLASHCARD_PANEL = "true-recall-flashcard-panel";
export const VIEW_TYPE_REVIEW = "true-recall-review";
export const VIEW_TYPE_STATS = "true-recall-stats";
export const VIEW_TYPE_SESSION = "true-recall-session";
export const VIEW_TYPE_PROJECTS = "true-recall-projects";
export const VIEW_TYPE_SIMULATOR = "true-recall-simulator";
export const VIEW_TYPE_ORPHANED_CARDS = "true-recall-orphaned-cards";
export const VIEW_TYPE_NOTE_HUB = "true-recall-note-hub";

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

export const DEFAULT_SETTINGS: TrueRecallSettings = {
	openRouterApiKey: "",
	aiModel: "google/gemini-3-flash-preview" as AIModelKey,
	customGeneratePrompt: "",

	fsrsRequestRetention: 0.9,
	fsrsMaximumInterval: 36500, // 100 years
	newCardsPerDay: 20,
	reviewsPerDay: 200,

	learningSteps: [1, 10], // minutes
	relearningSteps: [10], // minutes
	graduatingInterval: 1, // days
	easyInterval: 4, // days

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

	floatingButtonEnabled: false,
	floatingButtonMinChars: 1,
	floatingButtonDirectGenerate: false,

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

export const API_CONFIG = {
	endpoint: "https://openrouter.ai/api/v1/chat/completions",
	timeout: 60000, // 60 seconds
	defaultTemperature: 0.7,
	defaultMaxTokens: 4000,
	retryAttempts: 3,
	retryDelay: 1000,
} as const;

export const UI_CONFIG = {
	longPressDuration: 500, // ms, for showing card edit UI
	timerInterval: 1000, // ms
	defaultFileName: "Untitled",
} as const;

export const FLASHCARD_CONFIG = {
	sourceUidField: "flashcard_uid", // frontmatter field linking source note to cards
	tag: "#flashcard",
} as const;

export interface GeneratedNoteTypeConfig {
	type: GeneratedNoteType;
	label: string;
	description: string;
	tag: string;
	defaultNamePrefix: string;
}

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

export const SYSTEM_PROMPT = `I would like you to help me create flashcards based on text. Here are the guidelines for creating them.

Transform text into atomic, high-retention flashcards.

OUTPUT FORMAT:
[Question text] #flashcard
[Answer text]

(Note: The #flashcard tag belongs to the question line. The answer must NOT contain the #flashcard tag.)

MANDATORY RULES:
1. Do NOT number questions and answers. Also, do not write "FISZKA 1" or "FISZKA 1" or any similar variations. Only write question and answer.
2. Questions and answers must be concise.
3. One flashcard = ONE piece of information. If answer has multiple facts, create SEPARATE flashcards for each.
4. If multiple items must be in one answer, write them on separate lines, each preceded by a dot.
5. Create a flashcard for EVERY piece of information from the text.
6. Formulate questions and answers UNAMBIGUOUSLY. Each question leads to one specific answer.
7. Each flashcard has ONE keyword or concept in the question. Exception: answer may have multiple words only if stored as a fixed unit in memory.
8. We ask questions for each piece of information in each line of text.
9. If several flashcards would have IDENTICAL questions or differ only by one word in answer, MERGE them. List elements on separate lines with dots. Ideally, there should only be one piece of information in the response. If there are more than one, create separate flashcards with separate questions.
10. BOLD the keyword in every question using **bold**.
11. If the text contains NO new information for flashcards, return ONLY: NO_NEW_CARDS
12. Use english language for questions and answers.

FORMATTING:
- Backlinks: Wrap key scientific terms and main subjects in [[backlinks]] (bold backlinks). Use lowercase by default, but strictly preserve the original casing for technical terms (e.g., camelCase for useFetch, useState) and proper nouns.
- Use **[[term|alias]]** for context/readability when needed.
- Line Breaks: Use double newlines to split questions/answers longer than 6 words into logical parts. It's important.
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
**[[papulopustular changes]]**`;

// Used in review mode for free-form card creation
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
5. Use double newlines to split questions/answers into logical parts
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
A portable electronic device

designed for reading digital books

EXAMPLE 2:
User: Create 2 flashcards: What is photosynthesis? How do plants use sunlight?
Output:
What is **[[photosynthesis]]**? #flashcard
The process by which plants

convert light energy into chemical energy

How do **[[plants]]** use **[[sunlight]]**? #flashcard
To power photosynthesis,

producing glucose and oxygen

EXAMPLE 3:
User: What is machine learning? Leave the answer as ???
Output:
What is **[[machine learning]]**? #flashcard
???`;

// Used with Add & Generate to transform existing flashcards
export const CONTEXT_BASED_GENERATION_PROMPT = `You are an expert flashcard processor.
Transform the given flashcard according to the user's instruction.

INPUT: A flashcard (Q+A) and an instruction
OUTPUT: Processed flashcard(s) based on the instruction

Examples of instructions and expected behavior:
- "simplify" → Make the Q+A simpler, easier to understand
- "split into smaller cards" → Break into multiple atomic flashcards
- "add examples" → Expand the answer with concrete examples
- "make it more detailed" → Add more information to the answer
- "reverse" → Create a reverse card (answer becomes question)

OUTPUT FORMAT:
[Question text] #flashcard
[Answer text]

(Note: The #flashcard tag belongs to the question line. The answer must NOT contain the #flashcard tag.)

RULES:
1. Apply the instruction to TRANSFORM the flashcard
2. If splitting, create multiple cards - each atomic (one concept)
3. Questions and answers must be SHORT and CLEAR
4. BOLD the keyword in every question using **bold**
5. Wrap key terms in **[[backlinks]]** (bold backlinks)
6. Use double newlines to split questions/answers into logical parts

EXAMPLE 1 - Simplify:
Input flashcard:
Q: What is photosynthesis?
A: The process by which plants convert light energy into chemical energy stored in glucose

Instruction: simplify

Output:
What is **[[photosynthesis]]**? #flashcard
Plants converting light into food energy

EXAMPLE 2 - Split:
Input flashcard:
Q: What is photosynthesis?
A: Plants use sunlight, water, and CO2 to produce glucose and oxygen

Instruction: split into smaller cards

Output:
What do **[[plants]]** need for photosynthesis? #flashcard
Sunlight, water, and **[[CO2]]**

What do **[[plants]]** produce during photosynthesis? #flashcard
**[[Glucose]]** and **[[oxygen]]**

EXAMPLE 3 - Add examples:
Input flashcard:
Q: What is a mammal?
A: A warm-blooded animal that feeds milk to its young

Instruction: add examples

Output:
What is a **[[mammal]]**? #flashcard
A warm-blooded animal that feeds milk to its young

Examples: dogs, cats, whales, humans`;

// Generates related cards based on the card being reviewed
export const CONTEXT_AWARE_REVIEW_PROMPT = `You are an expert flashcard generator helping a user expand their knowledge during a review session.

The user is currently reviewing a flashcard and wants to generate NEW RELATED cards based on their instruction.

INPUT: You will receive the current flashcard (Q+A) the user is reviewing, and their instruction for generating new cards.

OUTPUT FORMAT:
[Question text] #flashcard
[Answer text]

(Note: The #flashcard tag belongs to the question line. The answer must NOT contain the #flashcard tag.)

RULES:
1. Generate NEW flashcards that RELATE to the current card's topic
2. Do NOT simply rephrase the original question - add new knowledge
3. Questions and answers must be SHORT and ATOMIC
4. One flashcard = ONE piece of information
5. BOLD the keyword in every question using **bold**
6. Wrap key terms in **[[backlinks]]** (bold backlinks)
7. Use double newlines to split questions/answers into logical parts

INSTRUCTION INTERPRETATIONS:
- "clarify" → Break down the concept into simpler, more specific parts
- "expand" → Add related facts, examples, or applications
- "similar" → Create questions about related concepts in the same domain
- "examples" → Generate cards with concrete examples of the concept
- "prerequisites" → Create cards about foundational knowledge needed
- "applications" → Generate cards about practical uses or real-world applications

EXAMPLE:
Current flashcard:
Q: What is photosynthesis?
A: The process by which plants convert light energy into chemical energy

User instruction: expand with more details

Output:
What are the **inputs** of **[[photosynthesis]]**? #flashcard
**[[Sunlight]]**, **[[water]]**, and **[[carbon dioxide]]**

What are the **outputs** of **[[photosynthesis]]**? #flashcard
**[[Glucose]]** (sugar) and **[[oxygen]]**

Where does **[[photosynthesis]]** occur in plant cells? #flashcard
In the **[[chloroplasts]]**,

specifically in the **[[thylakoid membranes]]**`;

// Parses various import formats (Q:/A:, numbered, tab-separated) into flashcard format
export const BATCH_IMPORT_PARSE_PROMPT = `You are a flashcard parser. Extract Q/A pairs from user text and apply proper formatting.

INPUT FORMATS TO RECOGNIZE:
- #flashcard: "Question #flashcard\\nAnswer"
- Q:/A:: "Q: Question\\nA: Answer"
- Numbered: "1. Question\\n   Answer"
- Tab-separated: "Question\\tAnswer"
- Plain blocks (blank line separator)

OUTPUT FORMAT:
Question text #flashcard
Answer text

Question2 text #flashcard
Answer2 text

FORMATTING RULES:
1. PRESERVE original meaning - no grammar/spelling fixes, no rewording
2. Wrap key terms/concepts in **[[backlinks|display text]]** format:
   - Use the canonical term as the link target
   - Use the original text as the alias if different
   - Example: "mitochondria" → **[[mitochondria]]**
   - Example: "the powerhouse of the cell" → **[[mitochondria|powerhouse of the cell]]**
3. Wrap code snippets in appropriate code blocks:
   - Inline code: \`code\`
   - Multi-line code: \`\`\`language\\ncode\\n\`\`\`
   - Detect language from context (python, javascript, typescript, sql, bash, etc.)
4. Skip unparseable sections
5. Output ONLY the reformatted flashcards

EXAMPLE INPUT:
Q: What does the map function do in JavaScript?
A: It creates a new array by calling a function on each element. Example: [1,2,3].map(x => x * 2) returns [2,4,6]

EXAMPLE OUTPUT:
What does the **[[map]]** function do in **[[JavaScript]]**? #flashcard
It creates a new array by calling a function on each element.

Example:
\`\`\`javascript
[1,2,3].map(x => x * 2)
// returns [2,4,6]
\`\`\``;

export const OPENROUTER_API_URL =
	"https://openrouter.ai/api/v1/chat/completions";

// Public anon key - safe to expose, RLS policies protect data per-user
export const TRUE_RECALL_CLOUD = {
	supabaseUrl: "https://webogcxwvgbwdcjibbno.supabase.co",
	supabaseAnonKey:
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlYm9nY3h3dmdid2RjamliYm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTE4NzYsImV4cCI6MjA4NDgyNzg3Nn0.IGrKykHY1gC-knNSy0jX1MF9vWp_b6YCURWyBXRmt0U",
} as const;
