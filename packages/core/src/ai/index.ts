// AI client configuration

// SQL query adapter
export {
	type DatabaseLike,
	type QueryExecResult,
	SqlQueryAdapter,
} from "./adapters/sql-query.adapter";
// OpenRouter client (non-streaming)
export {
	type AIClientOptions,
	AIRequestError,
	buildAIHeaders,
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
// Streaming OpenRouter client
export {
	type StreamChunk,
	type StreamingChatRequest,
	StreamingOpenRouterClient,
} from "./clients/streaming-openrouter-client";
export {
	type AIClientConfig,
	hasAIKey,
	resolveAIClientConfig,
} from "./config/ai-client-config";
// FSRS context for AI agents
export {
	FSRS_CONTEXT_FOR_AI,
	FSRS_QUICK_REFERENCE,
	FSRS_SQL_EXAMPLES,
	getFsrsContext,
} from "./context/fsrs-context";
// Chunked generation
export {
	type ChunkedGenerationResult,
	ChunkedGenerationService,
	type ConfirmLargeNote,
} from "./generation/chunked-generation.service";
export {
	type DraftGenerationOptions,
	DraftGenerationService,
} from "./generation/draft-generation.service";
// Flashcard generation (non-streaming)
export {
	FlashcardGenerationService,
	type GenerationResult,
} from "./generation/flashcard-generation.service";
// Card event processing
export {
	type CardEventFlashcardManager,
	processCardEvents,
	type SourceFileRef,
} from "./generation/process-card-events";
// Streaming generation
export {
	FALLBACK_BASIC_NOTE_TYPE,
	type StreamingFlashcardManager,
	type StreamingGenerationResult,
	StreamingGenerationService,
	type StreamingSourceFile,
} from "./generation/streaming-generation.service";
// Semantic answer grading
export { SemanticAnswerGradingService } from "./grading/semantic-answer-grading.service";
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
// Prompts
export { buildCardFormatSpec } from "./prompts/block-prompt-builder";
export {
	buildLanguageSuffix,
	GENERATION_LANGUAGES,
} from "./prompts/default-prompts";
export {
	buildTypeInGradingMessages,
	DEFAULT_TYPE_IN_GRADING_SYSTEM_PROMPT,
	type TypeInGradingPromptInput,
} from "./prompts/type-in-grading-prompt";
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
// Error handling
export { formatAIError } from "./utils/ai-error-handler";
// Source text fixer
export { fixBlockSourceTexts, fixSourceText } from "./utils/source-text-fixer";
// Image region detection (image occlusion AI)
export {
	type DetectRegionsOptions,
	detectRegionsFromImage,
	getMimeType,
	parseAIRegions,
} from "./vision/image-region-detection";
// Unified create/modify workflow facade
export {
	type AIWorkflow,
	type AIWorkflowContext,
	type AIWorkflowKind,
	assistantWorkflowId,
	CUSTOM_CARD_POLISH_PRESET_ID,
	cardPolishWorkflowId,
	customCardPolishWorkflowId,
	generationWorkflowId,
	listAIWorkflows,
	resolveAIWorkflow,
} from "./workflows/ai-workflow";
