// AI client configuration
export {
	type AIClientConfig,
	hasAIKey,
	resolveAIClientConfig,
} from "./config/ai-client-config";

// Error handling
export { formatAIError } from "./utils/ai-error-handler";

// Chunked generation
export {
	type ChunkedGenerationResult,
	ChunkedGenerationService,
	type ConfirmLargeNote,
} from "./generation/chunked-generation.service";

// Flashcard generation (non-streaming)
export {
	FlashcardGenerationService,
	type GenerationResult,
} from "./generation/flashcard-generation.service";

// FSRS context for AI agents
export {
	FSRS_CONTEXT_FOR_AI,
	FSRS_QUICK_REFERENCE,
	FSRS_SQL_EXAMPLES,
	getFsrsContext,
} from "./context/fsrs-context";

// Image region detection (image occlusion AI)
export {
	type DetectRegionsOptions,
	detectRegionsFromImage,
	getMimeType,
	parseAIRegions,
} from "./vision/image-region-detection";

// Incremental parser
export {
	IncrementalFlashcardParser,
	type IncrementalParseEvent,
	type NoteTypeLookup,
	parseBlockResponse,
} from "./parsing/incremental-flashcard-parser";

// Markdown chunker
export {
	type ChunkingResult,
	chunkMarkdown,
	filterContent,
	type MarkdownChunk,
} from "./parsing/markdown-chunker";

// OpenRouter client (non-streaming)
export {
	type AIClientOptions,
	AIRequestError,
	buildOpenRouterHeaders,
	type ChatCompletionResponse,
	type ChatMessage,
	type ContentPart,
	getTextContent,
	type ImageUrlContentPart,
	OPENROUTER_URL,
	OpenRouterClient,
	type TextContentPart,
	type ToolCall,
	type ToolDefinition,
} from "./clients/openrouter-client";

// Card event processing
export {
	type CardEventFlashcardManager,
	processCardEvents,
	type SourceFileRef,
} from "./generation/process-card-events";

// Prompts
export {
	buildByokPrompt,
	buildCardFormatSpec,
} from "./prompts/block-prompt-builder";
export {
	buildLanguageSuffix,
	GENERATION_LANGUAGES,
} from "./prompts/default-prompts";
export {
	buildTypeInGradingMessages,
	DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT,
	type TypeInGradingPromptInput,
} from "./prompts/type-in-grading-prompt";

// Semantic answer grading
export { SemanticAnswerGradingService } from "./grading/semantic-answer-grading.service";

// Source text fixer
export { fixBlockSourceTexts, fixSourceText } from "./utils/source-text-fixer";

// SQL query adapter
export {
	type DatabaseLike,
	type QueryExecResult,
	SqlQueryAdapter,
} from "./adapters/sql-query.adapter";

// Streaming generation
export {
	buildGenerationPrompt,
	FALLBACK_BASIC_NOTE_TYPE,
	type StreamingFlashcardManager,
	type StreamingGenerationResult,
	StreamingGenerationService,
	type StreamingSourceFile,
} from "./generation/streaming-generation.service";

// Streaming OpenRouter client
export {
	type StreamChunk,
	type StreamingChatRequest,
	StreamingOpenRouterClient,
} from "./clients/streaming-openrouter-client";

// Streaming state management
export {
	addStreamedCard,
	cancelStreaming,
	clearRecentCards,
	createThrottledPartialUpdater,
	finishStreaming,
	type ScheduleCallback,
	type StateListener,
	type StreamingGenerationState,
	type StreamingPhase,
	startStreaming,
	streamingGeneration,
	updateChunkProgress,
	updatePartial,
} from "./state/streaming-state";
