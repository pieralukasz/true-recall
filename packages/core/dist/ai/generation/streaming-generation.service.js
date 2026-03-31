import { __asyncValues, __awaiter } from "tslib";
import { buildByokPrompt, buildCardFormatSpec, } from "../prompts/block-prompt-builder";
import { StreamingOpenRouterClient } from "../clients/streaming-openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import { createThrottledPartialUpdater, finishStreaming, startStreaming, streamingGeneration, } from "../state/streaming-state";
import { processCardEvents, } from "./process-card-events";
export const FALLBACK_BASIC_NOTE_TYPE = {
    id: "builtin-basic",
    name: "Basic",
    type: 0,
    fields: ["Front", "Back"],
    templates: [],
    css: "",
    isBuiltin: true,
    slug: "basic",
};
export function buildGenerationPrompt(settings, noteType) {
    var _a;
    return buildByokPrompt(noteType !== null && noteType !== void 0 ? noteType : FALLBACK_BASIC_NOTE_TYPE, (_a = settings.generationLanguage) !== null && _a !== void 0 ? _a : "auto", settings.aiGenerationPrompt);
}
export class StreamingGenerationService {
    constructor(getSettings, flashcardManager, httpClient, schedule) {
        this.getSettings = getSettings;
        this.flashcardManager = flashcardManager;
        this.httpClient = httpClient;
        this.schedule = schedule;
    }
    generateStreaming(text, sourceFile, noteType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (streamingGeneration.value.isGenerating) {
                throw new Error("Generation already in progress");
            }
            const settings = this.getSettings();
            const aiConfig = resolveAIClientConfig(settings);
            const abortController = new AbortController();
            startStreaming(sourceFile.basename, sourceFile.path, abortController);
            try {
                return yield this.runStreamingGeneration(aiConfig, text, sourceFile, abortController, noteType);
            }
            catch (error) {
                if (abortController.signal.aborted) {
                    finishStreaming();
                }
                else {
                    finishStreaming(error instanceof Error ? error.message : String(error));
                }
                throw error;
            }
        });
    }
    runStreamingGeneration(aiConfig, text, sourceFile, abortController, noteType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d, _e;
            const client = new StreamingOpenRouterClient(aiConfig.apiKey, aiConfig.model, this.httpClient, aiConfig.baseUrl);
            const getNoteType = (slug) => { var _a, _b, _c; return (_c = (_b = (_a = this.flashcardManager).getNoteTypeBySlug) === null || _b === void 0 ? void 0 : _b.call(_a, slug)) !== null && _c !== void 0 ? _c : null; };
            const parser = new IncrementalFlashcardParser(getNoteType);
            const settings = this.getSettings();
            const customPrompt = ((_d = settings.aiGenerationPrompt) === null || _d === void 0 ? void 0 : _d.trim()) || "";
            const systemPrompt = aiConfig.isPro
                ? customPrompt
                : buildGenerationPrompt(settings, noteType);
            const metadata = aiConfig.isPro
                ? { call_context: "generation", note_type: (_e = noteType === null || noteType === void 0 ? void 0 : noteType.slug) !== null && _e !== void 0 ? _e : "basic" }
                : undefined;
            const userContent = aiConfig.isPro
                ? `${buildCardFormatSpec(noteType !== null && noteType !== void 0 ? noteType : FALLBACK_BASIC_NOTE_TYPE)}\n\n${text}`
                : text;
            let createdCount = 0;
            let duplicateCount = 0;
            const throttledUpdatePartial = createThrottledPartialUpdater(this.schedule);
            const onCount = (created, dups) => {
                createdCount += created;
                duplicateCount += dups;
            };
            const messages = systemPrompt
                ? [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                ]
                : [{ role: "user", content: userContent }];
            const stream = client.chatStream(Object.assign(Object.assign({ messages }, (aiConfig.isPro ? {} : { temperature: aiConfig.temperature })), { metadata }), abortController.signal);
            try {
                for (var _f = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _f = true) {
                    _c = stream_1_1.value;
                    _f = false;
                    const chunk = _c;
                    const events = parser.feed(chunk.content);
                    yield processCardEvents(events, sourceFile, this.flashcardManager, throttledUpdatePartial, onCount, text);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_f && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            const finalEvents = parser.finish();
            yield processCardEvents(finalEvents, sourceFile, this.flashcardManager, throttledUpdatePartial, onCount, text);
            finishStreaming();
            return { created: createdCount, duplicates: duplicateCount };
        });
    }
}
