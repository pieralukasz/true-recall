import { __asyncValues, __awaiter } from "tslib";
import { StreamingOpenRouterClient } from "../clients/streaming-openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import { buildPresetFormatSpec, buildPresetPrompt, } from "../prompts/block-prompt-builder";
import { renderExistingCardsBlock, } from "../prompts/existing-cards-block";
import { createThrottledPartialUpdater, finishStreaming, startStreaming, streamingGeneration, } from "../state/streaming-state";
import { resolveGenerationPresetAndNoteType } from "./preset-resolver";
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
export class StreamingGenerationService {
    constructor(getSettings, flashcardManager, httpClient, schedule) {
        this.getSettings = getSettings;
        this.flashcardManager = flashcardManager;
        this.httpClient = httpClient;
        this.schedule = schedule;
    }
    generate(text, sourceFile, presetId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.getSettings();
            const { preset, noteType } = resolveGenerationPresetAndNoteType(settings, this.flashcardManager, presetId);
            if (streamingGeneration.value.isGenerating) {
                throw new Error("Generation already in progress");
            }
            if (preset.requiresPro && !settings.proKey) {
                throw new Error(`Preset "${preset.name}" requires True Recall Pro. Upgrade or pick a different preset.`);
            }
            const aiConfig = resolveAIClientConfig(settings);
            const abortController = new AbortController();
            startStreaming(sourceFile.basename, sourceFile.path, abortController);
            try {
                return yield this.runPresetGeneration(aiConfig, text, sourceFile, abortController, preset, noteType, options);
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
    runPresetGeneration(aiConfig, text, sourceFile, abortController, preset, noteType, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d, _e;
            const client = new StreamingOpenRouterClient(aiConfig.apiKey, aiConfig.model, this.httpClient, aiConfig.baseUrl);
            const getNoteType = (slug) => { var _a, _b, _c; return (_c = (_b = (_a = this.flashcardManager).getNoteTypeBySlug) === null || _b === void 0 ? void 0 : _b.call(_a, slug)) !== null && _c !== void 0 ? _c : null; };
            const parser = new IncrementalFlashcardParser(getNoteType);
            // Prompts containing the {{EXISTING_CARDS}} placeholder are authoritative
            // full system prompts (e.g. built-in Pro preset) — use verbatim and send
            // the format spec as the user message so format instructions still reach
            // the model. Otherwise wrap the user's prompt in the format spec derived
            // from the note type and send the raw text as the user message.
            const useRawPrompt = preset.prompt.includes("{{EXISTING_CARDS}}");
            const rawSystemPrompt = useRawPrompt
                ? preset.prompt
                : buildPresetPrompt(preset, noteType);
            const existingCardsBlock = renderExistingCardsBlock((_d = options === null || options === void 0 ? void 0 : options.existingCards) !== null && _d !== void 0 ? _d : []);
            const systemPrompt = rawSystemPrompt.replace("{{EXISTING_CARDS}}", existingCardsBlock);
            const metadata = aiConfig.hasProTier
                ? {
                    call_context: "generation",
                    note_type: (_e = noteType.slug) !== null && _e !== void 0 ? _e : "basic",
                    preset_id: preset.id,
                }
                : undefined;
            const userContent = useRawPrompt
                ? `${buildPresetFormatSpec(preset, noteType)}\n\n${text}`
                : text;
            let createdCount = 0;
            let duplicateCount = 0;
            const createdCardIds = [];
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
            const stream = client.chatStream(Object.assign(Object.assign({ messages }, (aiConfig.hasProTier ? {} : { temperature: aiConfig.temperature })), { metadata }), abortController.signal);
            try {
                for (var _f = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _f = true) {
                    _c = stream_1_1.value;
                    _f = false;
                    const chunk = _c;
                    const events = parser.feed(chunk.content);
                    const ids = yield processCardEvents(events, sourceFile, this.flashcardManager, throttledUpdatePartial, onCount, text);
                    createdCardIds.push(...ids);
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
            const finalIds = yield processCardEvents(finalEvents, sourceFile, this.flashcardManager, throttledUpdatePartial, onCount, text);
            createdCardIds.push(...finalIds);
            finishStreaming();
            return {
                created: createdCount,
                duplicates: duplicateCount,
                createdCardIds,
                preset,
            };
        });
    }
}
