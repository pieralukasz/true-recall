import { __awaiter } from "tslib";
import { AIRequestError, getTextContent, OpenRouterClient, } from "../clients/openrouter-client";
import { resolveAIClientConfig, } from "../config/ai-client-config";
import { buildTypeInGradingMessages, } from "../prompts/type-in-grading-prompt";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_FEEDBACK_LENGTH = 280;
function clamp100(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
function truncateFeedback(feedback) {
    const normalized = feedback.trim().replace(/\s+/g, " ");
    if (normalized.length <= MAX_FEEDBACK_LENGTH)
        return normalized;
    return `${normalized.slice(0, MAX_FEEDBACK_LENGTH - 1)}…`;
}
function extractJsonBlock(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch === null || fencedMatch === void 0 ? void 0 : fencedMatch[1]) {
        return fencedMatch[1].trim();
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start)
        return null;
    return trimmed.slice(start, end + 1);
}
export class SemanticAnswerGradingService {
    constructor(getSettings, httpClient, createClient = (config) => new OpenRouterClient(config.apiKey, config.model, httpClient, config.baseUrl)) {
        this.getSettings = getSettings;
        this.createClient = createClient;
    }
    gradeAnswer(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.getSettings();
            let primaryConfig;
            try {
                primaryConfig = resolveAIClientConfig(settings);
            }
            catch (_a) {
                return this.buildLocalFallback(input, "AI key missing. Using local text comparison.");
            }
            try {
                return yield this.requestSemanticGrade(primaryConfig, input);
            }
            catch (error) {
                return this.buildLocalFallback(input, this.describeFailure(error));
            }
        });
    }
    requestSemanticGrade(config, input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const client = this.createClient(config);
            const timeoutMs = (_a = input.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT_MS;
            const metadata = config.hasProTier
                ? { call_context: "grading" }
                : undefined;
            const response = yield this.withTimeout(client.chat(Object.assign(Object.assign({ messages: buildTypeInGradingMessages({
                    question: input.question,
                    correctAnswer: input.correctAnswer,
                    userAnswer: input.userAnswer,
                    passThreshold: input.passThreshold,
                    sourceContext: input.sourceContext,
                    sourceNotePath: input.sourceNotePath,
                    relatedCards: input.relatedCards,
                }, this.getSettings().aiTypeInGradingPrompt) }, (config.hasProTier ? {} : { temperature: 0 })), { metadata })), timeoutMs);
            const content = getTextContent((_b = response.choices[0]) === null || _b === void 0 ? void 0 : _b.message);
            const parsed = this.parsePayload(content);
            const score = clamp100(parsed.score);
            return {
                score,
                feedback: config.hasProTier ? truncateFeedback(parsed.feedback) : "",
                passed: score >= clamp100(input.passThreshold),
                source: "ai",
            };
        });
    }
    parsePayload(content) {
        const jsonText = extractJsonBlock(content);
        if (!jsonText) {
            throw new Error("Invalid AI response format");
        }
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        }
        catch (_a) {
            throw new Error("Failed to parse AI JSON response");
        }
        if (!parsed ||
            typeof parsed !== "object" ||
            typeof parsed.score !== "number" ||
            typeof parsed.feedback !== "string") {
            throw new Error("AI response missing required fields");
        }
        return parsed;
    }
    withTimeout(promise, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("AI grading timeout"));
            }, timeoutMs);
            promise
                .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timeoutId);
                reject(error instanceof Error ? error : new Error(String(error)));
            });
        });
    }
    buildLocalFallback(input, reason) {
        const score = clamp100(input.localFallbackScore);
        return {
            score,
            passed: score >= clamp100(input.passThreshold),
            source: "local-fallback",
            feedback: truncateFeedback(reason),
        };
    }
    describeFailure(error) {
        if (error instanceof AIRequestError) {
            return `AI request failed (${error.statusCode}). Using local text comparison.`;
        }
        if (error instanceof Error) {
            return `${error.message}. Using local text comparison.`;
        }
        return "AI grading unavailable. Using local text comparison.";
    }
}
