import type { IHttpClient } from "../../interfaces/http-client";
import type { SemanticGradingResult, TrueRecallSettings } from "../../types";
import { type ChatCompletionResponse } from "../clients/openrouter-client";
import { type AIClientConfig } from "../config/ai-client-config";
import { type TypeInGradingPromptRelatedCard } from "../prompts/type-in-grading-prompt";
interface GradeAnswerInput {
    question: string;
    correctAnswer: string;
    userAnswer: string;
    passThreshold: number;
    localFallbackScore: number;
    timeoutMs?: number;
    sourceContext?: string;
    sourceNotePath?: string;
    relatedCards?: TypeInGradingPromptRelatedCard[];
}
type ClientFactory = (config: AIClientConfig) => {
    chat: (request: {
        messages: Array<{
            role: "system" | "user";
            content: string;
        }>;
        temperature?: number;
        metadata?: Record<string, unknown>;
    }) => Promise<ChatCompletionResponse>;
};
export declare class SemanticAnswerGradingService {
    private getSettings;
    private createClient;
    constructor(getSettings: () => TrueRecallSettings, httpClient: IHttpClient, createClient?: ClientFactory);
    gradeAnswer(input: GradeAnswerInput): Promise<SemanticGradingResult>;
    private requestSemanticGrade;
    private parsePayload;
    private withTimeout;
    private buildLocalFallback;
    private describeFailure;
}
export {};
