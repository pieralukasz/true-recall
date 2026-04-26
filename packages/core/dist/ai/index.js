// AI client configuration
// SQL query adapter
export { SqlQueryAdapter, } from "./adapters/sql-query.adapter";
// Card AI (unified polish + draft/generate pipeline)
export * from "./card-ai";
// OpenRouter client (non-streaming)
export { AIRequestError, buildOpenRouterHeaders, getTextContent, OPENROUTER_URL, OpenRouterClient, } from "./clients/openrouter-client";
// Streaming OpenRouter client
export { StreamingOpenRouterClient, } from "./clients/streaming-openrouter-client";
export { hasAIKey, resolveAIClientConfig, } from "./config/ai-client-config";
// FSRS context for AI agents
export { FSRS_CONTEXT_FOR_AI, FSRS_QUICK_REFERENCE, FSRS_SQL_EXAMPLES, getFsrsContext, } from "./context/fsrs-context";
// Chunked generation
export { ChunkedGenerationService, } from "./generation/chunked-generation.service";
// Flashcard generation (non-streaming)
export { FlashcardGenerationService, } from "./generation/flashcard-generation.service";
// Card event processing
export { processCardEvents, } from "./generation/process-card-events";
// Streaming generation
export { FALLBACK_BASIC_NOTE_TYPE, StreamingGenerationService, } from "./generation/streaming-generation.service";
// Semantic answer grading
export { SemanticAnswerGradingService } from "./grading/semantic-answer-grading.service";
// Incremental parser
export { IncrementalFlashcardParser, parseBlockResponse, } from "./parsing/incremental-flashcard-parser";
// Markdown chunker
export { chunkMarkdown, filterContent, } from "./parsing/markdown-chunker";
// Prompts
export { buildCardFormatSpec } from "./prompts/block-prompt-builder";
export { buildLanguageSuffix, GENERATION_LANGUAGES, } from "./prompts/default-prompts";
export { buildTypeInGradingMessages, DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT, } from "./prompts/type-in-grading-prompt";
// Streaming state management
export { addStreamedCard, cancelStreaming, clearRecentCards, createThrottledPartialUpdater, finishStreaming, startStreaming, streamingGeneration, updateChunkProgress, updatePartial, } from "./state/streaming-state";
// TTS (text-to-speech)
export { AudioStorageService } from "./tts/audio-storage.service";
export { buildTTSRequest, getTTSAudioFilename, TTS_AUDIO_DIR, } from "./tts/tts.service";
export { getVoiceConfig } from "./tts/tts-voice-map";
// Error handling
export { formatAIError } from "./utils/ai-error-handler";
// Source text fixer
export { fixBlockSourceTexts, fixSourceText } from "./utils/source-text-fixer";
// Image region detection (image occlusion AI)
export { detectRegionsFromImage, getMimeType, parseAIRegions, } from "./vision/image-region-detection";
