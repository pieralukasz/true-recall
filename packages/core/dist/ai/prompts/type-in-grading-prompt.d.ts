export interface TypeInGradingPromptInput {
    question: string;
    correctAnswer: string;
    userAnswer: string;
    passThreshold: number;
    sourceContext?: string;
}
export declare const DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT: string;
export declare function buildTypeInGradingMessages(input: TypeInGradingPromptInput, customSystemPrompt?: string): Array<{
    role: "system" | "user";
    content: string;
}>;
