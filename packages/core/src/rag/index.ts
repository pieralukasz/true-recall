// RAG — platform-independent search, chunking, and persistence

export type {
	EmbeddingRow,
	RagChunkRow,
	RagIndexMetaRow,
	RagSourceType,
} from "./indexing/rag-chunk-actions";
export { RagChunkActions } from "./indexing/rag-chunk-actions";
export { RagSchemaManager } from "./indexing/rag-schema";
export type { RagChunk } from "./ingestion/rag-chunker.service";
export { chunkDailyNote, chunkFlashcard, chunkNote } from "./ingestion/rag-chunker.service";
export type { DailyNoteInfo } from "./ingestion/daily-note-preprocessor";
export { preprocessDailyNote } from "./ingestion/daily-note-preprocessor";
export type {
	RagEmbeddingService,
	SearchResult,
	SearchStats,
} from "./retrieval/rag-search.service";
export { RagSearchService } from "./retrieval/rag-search.service";
export {
	RAG_CHAT_TOOLS,
	RagToolExecutor,
	type ToolResult,
} from "./chat/rag-chat-tools";
export { StudyDataGatherer } from "./study/study-data-gatherer";
export { classifyIntent, type StudyIntent } from "./study/study-intent-classifier";

// Chat services
export { RagEmbeddingServiceImpl } from "./retrieval/rag-embedding.service";
export {
	RagQueryService,
	type ChatTurn,
	type ToolCallRecord,
	type ContextResolver,
} from "./chat/rag-query.service";
export { RagChatService } from "./chat/rag-chat.service";

// Context types
export type {
	NoteContextItem,
	CardContextItem,
	ContextItem,
} from "./context/context.types";
export { contextKey } from "./context/context.types";

// Source grouping
export type { GroupedSource } from "./retrieval/rag-source-grouper";
export { groupSources, stripMarkdown } from "./retrieval/rag-source-grouper";
