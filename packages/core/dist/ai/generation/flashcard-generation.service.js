import { __awaiter } from "tslib";
import { getTextContent, OpenRouterClient } from "../clients/openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { parseBlockResponse } from "../parsing/incremental-flashcard-parser";
import { buildCardFormatSpec } from "../prompts/block-prompt-builder";
import { fixBlockSourceTexts } from "../utils/source-text-fixer";
import { buildGenerationPrompt, FALLBACK_BASIC_NOTE_TYPE, } from "./streaming-generation.service";
export class FlashcardGenerationService {
    constructor(getSettings, getNoteType, httpClient) {
        this.getSettings = getSettings;
        this.getNoteType = getNoteType;
        this.httpClient = httpClient;
    }
    generate(selectedText, noteType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const settings = this.getSettings();
            const config = resolveAIClientConfig(settings);
            const client = new OpenRouterClient(config.apiKey, config.model, this.httpClient, config.baseUrl);
            const customPrompt = ((_a = settings.aiGenerationPrompt) === null || _a === void 0 ? void 0 : _a.trim()) || "";
            const systemPrompt = config.isPro
                ? customPrompt
                : buildGenerationPrompt(settings, noteType);
            const userContent = config.isPro
                ? `${buildCardFormatSpec(noteType !== null && noteType !== void 0 ? noteType : FALLBACK_BASIC_NOTE_TYPE)}\n\n${selectedText}`
                : selectedText;
            const messages = systemPrompt
                ? [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                ]
                : [{ role: "user", content: userContent }];
            const metadata = config.isPro
                ? { call_context: "generation", note_type: (_b = noteType === null || noteType === void 0 ? void 0 : noteType.slug) !== null && _b !== void 0 ? _b : "basic" }
                : undefined;
            const request = Object.assign(Object.assign({ messages }, (config.isPro ? {} : { temperature: config.temperature })), { metadata });
            const response = yield client.chat(request);
            const responseText = getTextContent((_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message);
            const blocks = this.parseResponse(responseText);
            fixBlockSourceTexts(blocks, selectedText);
            return { blocks };
        });
    }
    parseResponse(text) {
        const blocks = parseBlockResponse(text, this.getNoteType);
        if (text.trim() && blocks.length === 0) {
            console.warn("[TrueRecall] AI response produced no parseable flashcards", { responseLength: text.length });
        }
        return blocks;
    }
}
