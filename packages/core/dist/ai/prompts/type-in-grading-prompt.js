export const DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT = "You are grading typed answers for flashcards.\n" +
    "Evaluate semantic correctness, not wording.\n" +
    "Penalize missing critical facts and contradictions.\n" +
    "Be concise and fair.\n" +
    'Return JSON only with keys: {"score": number, "feedback": string}.\n' +
    "score must be 0-100.\n" +
    "feedback must be at most 2 short sentences.\n" +
    "Do not return markdown or code fences.";
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
                ...(input.sourceContext
                    ? [
                        "Source note context (use to judge domain-specific terminology and synonyms):",
                        "<context>",
                        input.sourceContext,
                        "</context>",
                        "",
                    ]
                    : []),
                `Question: ${input.question}`,
                `Correct answer: ${input.correctAnswer}`,
                `User answer: ${input.userAnswer}`,
                `Pass threshold: ${input.passThreshold}`,
                'Output JSON only: {"score": number, "feedback": string}',
            ].join("\n"),
        },
    ];
}
