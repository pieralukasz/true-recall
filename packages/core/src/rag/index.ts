// RAG — platform-independent search, chunking, and persistence

export type {
	EmbeddingRow,
	RagChunkRow,
	RagIndexMetaRow,
	RagSourceType,
} from "./rag-chunk-actions";
export { RagChunkActions } from "./rag-chunk-actions";
export { RagSchemaManager } from "./rag-schema";
export type { RagChunk } from "./rag-chunker.service";
export { chunkDailyNote, chunkFlashcard, chunkNote } from "./rag-chunker.service";
export type { DailyNoteInfo } from "./daily-note-preprocessor";
export { preprocessDailyNote } from "./daily-note-preprocessor";
export type {
	RagEmbeddingService,
	SearchResult,
	SearchStats,
} from "./rag-search.service";
export { RagSearchService } from "./rag-search.service";
export {
	RAG_CHAT_TOOLS,
	RagToolExecutor,
	type ToolResult,
} from "./rag-chat-tools";
export { StudyDataGatherer } from "./study-data-gatherer";
export { classifyIntent, type StudyIntent } from "./study-intent-classifier";

// Chat services
export { RagEmbeddingServiceImpl } from "./rag-embedding.service";
export {
	RagQueryService,
	type ChatTurn,
	type ToolCallRecord,
	type ContextResolver,
} from "./rag-query.service";
export { RagChatService } from "./rag-chat.service";

// Context types
export type {
	NoteContextItem,
	CardContextItem,
	ContextItem,
} from "./context/context.types";
export { contextKey } from "./context/context.types";
