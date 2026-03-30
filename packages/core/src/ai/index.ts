// AI client configuration
export {
	type AIClientConfig,
	resolveAIClientConfig,
	hasAIKey,
} from "./ai-client-config";

// Error handling
export { formatAIError } from "./ai-error-handler";

// OpenRouter client (non-streaming)
export {
	type TextContentPart,
	type ImageUrlContentPart,
	type ContentPart,
	type ChatMessage,
	type ToolCall,
	type ToolDefinition,
	type ChatCompletionResponse,
	type AIClientOptions,
	OPENROUTER_URL,
	buildOpenRouterHeaders,
	getTextContent,
	AIRequestError,
	OpenRouterClient,
} from "./openrouter-client";

// Streaming OpenRouter client
export {
	type StreamingChatRequest,
	type StreamChunk,
	StreamingOpenRouterClient,
} from "./streaming-openrouter-client";

// Streaming state management
export {
	type StreamingPhase,
	type StreamingGenerationState,
	type StateListener,
	type ScheduleCallback,
	streamingGeneration,
	startStreaming,
	addStreamedCard,
	updatePartial,
	updateChunkProgress,
	finishStreaming,
	clearRecentCards,
	cancelStreaming,
	createThrottledPartialUpdater,
} from "./streaming-state";

// Flashcard generation (non-streaming)
export {
	type GenerationResult,
	FlashcardGenerationService,
} from "./flashcard-generation.service";

// Streaming generation
export {
	FALLBACK_BASIC_NOTE_TYPE,
	buildGenerationPrompt,
	type StreamingGenerationResult,
	type StreamingSourceFile,
	type StreamingFlashcardManager,
	StreamingGenerationService,
} from "./streaming-generation.service";

// Chunked generation
export {
	type ChunkedGenerationResult,
	type ConfirmLargeNote,
	ChunkedGenerationService,
} from "./chunked-generation.service";

// Card event processing
export {
	type SourceFileRef,
	type CardEventFlashcardManager,
	processCardEvents,
} from "./process-card-events";

// Incremental parser
export {
	type IncrementalParseEvent,
	type NoteTypeLookup,
	parseBlockResponse,
	IncrementalFlashcardParser,
} from "./incremental-flashcard-parser";

// Semantic answer grading
export { SemanticAnswerGradingService } from "./semantic-answer-grading.service";

// Source text fixer
export { fixSourceText, fixBlockSourceTexts } from "./source-text-fixer";

// Markdown chunker
export {
	type MarkdownChunk,
	type ChunkingResult,
	filterContent,
	chunkMarkdown,
} from "./markdown-chunker";

// FSRS context for AI agents
export {
	FSRS_CONTEXT_FOR_AI,
	FSRS_QUICK_REFERENCE,
	FSRS_SQL_EXAMPLES,
	getFsrsContext,
} from "./fsrs-context";

// SQL query adapter
export {
	type QueryExecResult,
	type DatabaseLike,
	SqlQueryAdapter,
} from "./sql-query.adapter";

// Prompts
export {
	buildCardFormatSpec,
	buildByokPrompt,
} from "./prompts/block-prompt-builder";
export {
	GENERATION_LANGUAGES,
	buildLanguageSuffix,
} from "./prompts/default-prompts";
export {
	type TypeInGradingPromptInput,
	DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT,
	buildTypeInGradingMessages,
} from "./prompts/type-in-grading-prompt";
