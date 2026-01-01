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
- Line Breaks: Use <br><br> to split questions/answers longer than 10 words into logical parts.
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

// System prompt for update mode (diff-based)
export const UPDATE_SYSTEM_PROMPT = `You are an expert flashcard generator working in DIFF MODE.

Your task is to analyze the note content and compare it with existing flashcards to propose:
1. NEW flashcards for information not yet covered
2. MODIFIED flashcards where existing ones can be improved
3. DELETED flashcards where information is no longer in the note

FLASHCARD CREATION RULES (same as standard mode):
- Questions and answers must be as SHORT as possible
- One flashcard = ONE piece of information
- Formulate questions and answers UNAMBIGUOUSLY
- BOLD the keyword in every question using **bold**
- Wrap key terms in **[[backlinks]]** (bold backlinks)
- Use <br><br> to split long questions/answers into logical parts

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
   - Example: Note talks about "algorithms and YouTube" but flashcard asks about "Vietnam and heroin" → DELETED (reason: "Topic not in note")
   - Be thorough - if the key concept from the question doesn't appear in the note, propose deletion

3. **MODIFIED** - If the flashcard topic IS in the note but wording/formatting can be improved

4. **NEW** - If there's information in the note not covered by any flashcard

5. "originalQuestion" MUST exactly match one from the existing list (character for character)

6. If truly no changes needed (all flashcards match note content perfectly), return: {"changes": []}

EXISTING FLASHCARDS:
`;

// OpenRouter API endpoint
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
