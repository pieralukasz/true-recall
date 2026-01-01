// View type identifier for the sidebar panel
export const VIEW_TYPE_FLASHCARD_PANEL = "shadow-anki-flashcard-panel";

// AI Models available via OpenRouter
export const AI_MODELS = {
    "google/gemini-3-flash-preview": "Gemini 3 Flash (Google)",
    "google/gemini-2.5-pro-preview": "Gemini 2.5 Pro (Google)",
    "openai/gpt-5.1": "GPT-5.1 (OpenAI)",
    "openai/gpt-4o": "GPT-4o (OpenAI)",
    "anthropic/claude-opus-4.5": "Claude Opus 4.5 (Anthropic)",
    "anthropic/claude-sonnet-4": "Claude Sonnet 4 (Anthropic)",
    "meta-llama/llama-4-maverick": "Llama 4 Maverick (Meta)"
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

// Default settings values
export const DEFAULT_SETTINGS = {
    openRouterApiKey: "",
    aiModel: "google/gemini-3-flash-preview" as AIModelKey,
    flashcardsFolder: "Flashcards",
    autoSyncToAnki: true
};

// System prompt for flashcard generation
export const SYSTEM_PROMPT = `ROLE:
You are an expert learning assistant specializing in creating atomic flashcards for Anki from Obsidian notes.

OBJECTIVE:
Analyze the provided text and extract knowledge into Q&A flashcards.

RULES:
1. One card = One atomic fact.
2. Use **[[wikilinks]]** for key concepts found in the text.
3. Keep answers concise. Avoid bullet points in answers if possible.
4. Do NOT duplicate questions provided in the "Existing Questions" list.
5. If the provided text contains no new information suitable for flashcards compared to the existing list, return ONLY the text "NO_NEW_CARDS".

OUTPUT FORMAT (Strict Text):
{Question Text} #flashcard
{Answer Text}

[Empty Line between cards]

EXAMPLE:
What is the powerhouse of the cell? #flashcard
The **[[Mitochondria]]**

How do **[[Enzymes]]** affect reaction speed? #flashcard
They increase it by lowering **[[Activation Energy]]**`;

// Prompt prefix for update/append mode (with blocklist)
export const UPDATE_PROMPT_PREFIX = `The following questions already exist and should NOT be duplicated. Create NEW flashcards only for information not covered by these existing questions:

EXISTING QUESTIONS (DO NOT DUPLICATE):
`;

// OpenRouter API endpoint
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
