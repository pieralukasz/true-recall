// AI client configuration
export { hasAIKey, resolveAIClientConfig, } from "./config/ai-client-config";
// Error handling
export { formatAIError } from "./utils/ai-error-handler";
// Chunked generation
export { ChunkedGenerationService, } from "./generation/chunked-generation.service";
// Flashcard generation (non-streaming)
export { FlashcardGenerationService, } from "./generation/flashcard-generation.service";
// FSRS context for AI agents
export { FSRS_CONTEXT_FOR_AI, FSRS_QUICK_REFERENCE, FSRS_SQL_EXAMPLES, getFsrsContext, } from "./context/fsrs-context";
// Image region detection (image occlusion AI)
export { detectRegionsFromImage, getMimeType, parseAIRegions, } from "./vision/image-region-detection";
// Incremental parser
export { IncrementalFlashcardParser, parseBlockResponse, } from "./parsing/incremental-flashcard-parser";
// Markdown chunker
export { chunkMarkdown, filterContent, } from "./parsing/markdown-chunker";
// OpenRouter client (non-streaming)
export { AIRequestError, buildOpenRouterHeaders, getTextContent, OPENROUTER_URL, OpenRouterClient, } from "./clients/openrouter-client";
// Card event processing
export { processCardEvents, } from "./generation/process-card-events";
// Prompts
export { buildByokPrompt, buildCardFormatSpec, } from "./prompts/block-prompt-builder";
export { buildLanguageSuffix, GENERATION_LANGUAGES, } from "./prompts/default-prompts";
export { buildTypeInGradingMessages, DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT, } from "./prompts/type-in-grading-prompt";
// Semantic answer grading
export { SemanticAnswerGradingService } from "./grading/semantic-answer-grading.service";
// Source text fixer
export { fixBlockSourceTexts, fixSourceText } from "./utils/source-text-fixer";
// SQL query adapter
export { SqlQueryAdapter, } from "./adapters/sql-query.adapter";
// Streaming generation
export { buildGenerationPrompt, FALLBACK_BASIC_NOTE_TYPE, StreamingGenerationService, } from "./generation/streaming-generation.service";
// Streaming OpenRouter client
export { StreamingOpenRouterClient, } from "./clients/streaming-openrouter-client";
// Streaming state management
export { addStreamedCard, cancelStreaming, clearRecentCards, createThrottledPartialUpdater, finishStreaming, startStreaming, streamingGeneration, updateChunkProgress, updatePartial, } from "./state/streaming-state";
