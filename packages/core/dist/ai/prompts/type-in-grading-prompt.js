const SOURCE_NOTE_CHAR_LIMIT = 4000;
export const DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT = "You are grading typed answers for flashcards.\n" +
    "Evaluate semantic correctness, not wording.\n" +
    "Penalize missing critical facts and contradictions.\n" +
    "Use the source note and related flashcards (when provided) only as background to judge domain-specific terminology, synonyms, and the expected scope — never as a substitute for the user's answer.\n" +
    "Be concise and fair.\n" +
    'Return JSON only with keys: {"score": number, "feedback": string}.\n' +
    "score must be 0-100.\n" +
    "feedback must be at most 2 short sentences.\n" +
    "Do not return markdown or code fences.";
function buildSourceNoteSection(input) {
    var _a, _b, _c, _d, _e;
    const text = (_a = input.sourceContext) === null || _a === void 0 ? void 0 : _a.trim();
    if (!text)
        return [];
    const path = input.sourceNotePath ? ` (${input.sourceNotePath})` : "";
    const body = (_c = (_b = input.sourceContext) === null || _b === void 0 ? void 0 : _b.slice(0, SOURCE_NOTE_CHAR_LIMIT)) !== null && _c !== void 0 ? _c : "";
    const truncated = ((_e = (_d = input.sourceContext) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0) > SOURCE_NOTE_CHAR_LIMIT ? "\n…" : "";
    return [
        `Source note${path} (background only — judge synonyms and domain terminology):`,
        "<context>",
        `${body}${truncated}`,
        "</context>",
        "",
    ];
}
function buildRelatedCardsSection(input) {
    const cards = input.relatedCards;
    if (!(cards === null || cards === void 0 ? void 0 : cards.length))
        return [];
    const formatted = cards
        .map((card, index) => {
        const body = Object.entries(card.fields)
            .map(([name, value]) => `  ${name}: ${value}`)
            .join("\n");
        return `#${index + 1} (${card.noteType})\n${body}`;
    })
        .join("\n\n");
    return [
        "Related flashcards from the same source (background only — show the expected scope and terminology; do not treat them as the user's answer):",
        formatted,
        "",
    ];
}
export function buildTypeInGradingMessages(input, customSystemPrompt) {
    const systemPrompt = (customSystemPrompt === null || customSystemPrompt === void 0 ? void 0 : customSystemPrompt.trim().length)
        ? customSystemPrompt
        : DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT;
    return [
        {
            role: "system",
            content: systemPrompt,
        },
        {
            role: "user",
            content: [
                ...buildSourceNoteSection(input),
                ...buildRelatedCardsSection(input),
                `Question: ${input.question}`,
                `Correct answer: ${input.correctAnswer}`,
                `User answer: ${input.userAnswer}`,
                `Pass threshold: ${input.passThreshold}`,
                'Output JSON only: {"score": number, "feedback": string}',
            ].join("\n"),
        },
    ];
}
