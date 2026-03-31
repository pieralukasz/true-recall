import { __awaiter } from "tslib";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export function buildOpenRouterHeaders(apiKey, userId) {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "obsidian://true-recall",
        "X-Title": "True Recall",
    };
    if (userId)
        headers["X-User-Id"] = userId;
    return headers;
}
/** Extract text content from a ChatMessage response (handles both string and ContentPart[] content). */
export function getTextContent(message) {
    if (!message)
        return "";
    if (typeof message.content === "string")
        return message.content;
    if (Array.isArray(message.content)) {
        return message.content
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
    }
    return "";
}
export class AIRequestError extends Error {
    constructor(statusCode, responseText) {
        super(`AI API error (${statusCode}): ${responseText}`);
        this.statusCode = statusCode;
        this.name = "AIRequestError";
    }
    get isRateLimited() {
        return this.statusCode === 429;
    }
    get isUnauthorized() {
        return this.statusCode === 401;
    }
}
export class OpenRouterClient {
    constructor(apiKey, model, httpClient, baseUrl = OPENROUTER_URL, userId) {
        this.apiKey = apiKey;
        this.model = model;
        this.httpClient = httpClient;
        this.baseUrl = baseUrl;
        this.userId = userId;
    }
    chat(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = buildOpenRouterHeaders(this.apiKey, this.userId);
            const response = yield this.httpClient.post(this.baseUrl, Object.assign({ model: this.model }, request), headers);
            if (response.status !== 200) {
                throw new AIRequestError(response.status, response.text);
            }
            return response.json;
        });
    }
}
