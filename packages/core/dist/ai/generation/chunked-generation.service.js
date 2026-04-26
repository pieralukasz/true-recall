import { __asyncValues, __awaiter } from "tslib";
import { StreamingOpenRouterClient } from "../clients/streaming-openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import { IncrementalFlashcardParser } from "../parsing/incremental-flashcard-parser";
import { chunkMarkdown, } from "../parsing/markdown-chunker";
import { buildPresetFormatSpec, buildPresetPrompt, } from "../prompts/block-prompt-builder";
import { renderExistingCardsBlock, } from "../prompts/existing-cards-block";
import { createThrottledPartialUpdater, finishStreaming, startStreaming, updateChunkProgress, } from "../state/streaming-state";
import { resolveGenerationPresetAndNoteType } from "./preset-resolver";
import { processCardEvents } from "./process-card-events";
import { StreamingGenerationService, } from "./streaming-generation.service";
const COST_CONFIRM_WORD_THRESHOLD = 5000;
const COST_PER_TOKEN = 0.15 / 1000000;
export class ChunkedGenerationService {
    constructor(getSettings, flashcardManager, httpClient, schedule) {
        this.getSettings = getSettings;
        this.flashcardManager = flashcardManager;
        this.httpClient = httpClient;
        this.schedule = schedule;
    }
    generateFromNote(content, sourceFile, presetId, options, confirmLargeNote) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.getSettings();
            const { preset, noteType } = resolveGenerationPresetAndNoteType(settings, this.flashcardManager, presetId);
            const chunkingResult = chunkMarkdown(content);
            if (chunkingResult.strategy === "single") {
                const firstChunk = chunkingResult.chunks[0];
                if (!firstChunk)
                    throw new Error("Expected at least one chunk");
                const streamingService = new StreamingGenerationService(this.getSettings, this.flashcardManager, this.httpClient, this.schedule);
                const result = yield streamingService.generate(firstChunk.content, sourceFile, presetId, options);
                return Object.assign(Object.assign({}, result), { failedChunks: 0, totalChunks: 1, errors: [] });
            }
            return this.runChunkedGeneration(chunkingResult, sourceFile, preset, noteType, options, confirmLargeNote);
        });
    }
    runChunkedGeneration(chunkingResult, sourceFile, preset, noteType, options, confirmLargeNote) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { chunks, totalWords, estimatedTokens } = chunkingResult;
            if (confirmLargeNote && totalWords > COST_CONFIRM_WORD_THRESHOLD) {
                const estimatedCost = estimatedTokens * 1.3 * COST_PER_TOKEN;
                const proceed = yield confirmLargeNote({
                    title: "Large Note Detected",
                    message: `This note has ~${totalWords.toLocaleString()} words (~${estimatedTokens.toLocaleString()} tokens). It will be split into ${chunks.length} sections for better quality.\n\nEstimated cost: ~$${estimatedCost.toFixed(3)}`,
                    confirmLabel: "Generate",
                    cancelLabel: "Cancel",
                });
                if (!proceed) {
                    throw new DOMException("User cancelled", "AbortError");
                }
            }
            const abortController = new AbortController();
            startStreaming(sourceFile.basename, sourceFile.path, abortController, chunks.length);
            const settings = this.getSettings();
            const aiConfig = resolveAIClientConfig(settings);
            // Prompts containing the {{EXISTING_CARDS}} placeholder are authoritative
            // full system prompts (e.g. built-in Pro preset) — use verbatim and send
            // the format spec as the user message so format instructions still reach
            // the model. Otherwise wrap the user's prompt in the format spec derived
            // from the note type and send the raw text as the user message.
            const useRawPrompt = preset.prompt.includes("{{EXISTING_CARDS}}");
            const rawSystemPrompt = useRawPrompt
                ? preset.prompt
                : buildPresetPrompt(preset, noteType);
            const existingCardsBlock = renderExistingCardsBlock((_a = options === null || options === void 0 ? void 0 : options.existingCards) !== null && _a !== void 0 ? _a : []);
            const systemPrompt = rawSystemPrompt.replace("{{EXISTING_CARDS}}", existingCardsBlock);
            let totalCreated = 0;
            let totalDuplicates = 0;
            let failedChunks = 0;
            const errors = [];
            const allCreatedCardIds = [];
            try {
                for (const chunk of chunks) {
                    if (abortController.signal.aborted)
                        break;
                    updateChunkProgress(chunk.index, chunk.headingBreadcrumb || null);
                    const formatPrefix = useRawPrompt
                        ? `${buildPresetFormatSpec(preset, noteType)}\n\n`
                        : "";
                    const userMessage = chunk.headingBreadcrumb
                        ? `${formatPrefix}[Context: This section is from "${chunk.headingBreadcrumb}" in the note "${sourceFile.basename}"]\n\n${chunk.content}`
                        : `${formatPrefix}${chunk.content}`;
                    try {
                        const result = yield this.generateSingleChunk(aiConfig, systemPrompt, userMessage, sourceFile, abortController.signal, noteType, preset, chunk.content);
                        totalCreated += result.created;
                        totalDuplicates += result.duplicates;
                        allCreatedCardIds.push(...result.createdCardIds);
                    }
                    catch (error) {
                        if (error instanceof DOMException && error.name === "AbortError") {
                            break;
                        }
                        failedChunks++;
                        const msg = error instanceof Error ? error.message : String(error);
                        errors.push(`Section ${chunk.index + 1}${chunk.headingBreadcrumb ? ` (${chunk.headingBreadcrumb})` : ""}: ${msg}`);
                        console.error(`[ChunkedGeneration] Chunk ${chunk.index} failed:`, error);
                    }
                }
            }
            finally {
                finishStreaming();
            }
            return {
                created: totalCreated,
                duplicates: totalDuplicates,
                createdCardIds: allCreatedCardIds,
                preset,
                failedChunks,
                totalChunks: chunks.length,
                errors,
            };
        });
    }
    generateSingleChunk(aiConfig, systemPrompt, userMessage, sourceFile, signal, noteType, preset, chunkContent) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d;
            const client = new StreamingOpenRouterClient(aiConfig.apiKey, aiConfig.model, this.httpClient, aiConfig.baseUrl);
            const getNoteType = (slug) => { var _a, _b, _c; return (_c = (_b = (_a = this.flashcardManager).getNoteTypeBySlug) === null || _b === void 0 ? void 0 : _b.call(_a, slug)) !== null && _c !== void 0 ? _c : null; };
            const parser = new IncrementalFlashcardParser(getNoteType);
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
                    { role: "user", content: userMessage },
                ]
                : [{ role: "user", content: userMessage }];
            const metadata = aiConfig.hasProTier
                ? { call_context: "generation", note_type: (_d = noteType === null || noteType === void 0 ? void 0 : noteType.slug) !== null && _d !== void 0 ? _d : "basic" }
                : undefined;
            const stream = client.chatStream(Object.assign(Object.assign({ messages }, (aiConfig.hasProTier ? {} : { temperature: aiConfig.temperature })), { metadata }), signal);
            try {
                for (var _e = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _e = true) {
                    _c = stream_1_1.value;
                    _e = false;
                    const chunk = _c;
                    const events = parser.feed(chunk.content);
                    const ids = yield processCardEvents(events, sourceFile, this.flashcardManager, throttledUpdatePartial, onCount, chunkContent);
                    createdCardIds.push(...ids);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_e && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            const finalEvents = parser.finish();
            const finalIds = yield processCardEvents(finalEvents, sourceFile, this.flashcardManager, throttledUpdatePartial, onCount, chunkContent);
            createdCardIds.push(...finalIds);
            return {
                created: createdCount,
                duplicates: duplicateCount,
                createdCardIds,
                preset,
            };
        });
    }
}
