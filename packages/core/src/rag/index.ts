// RAG — platform-independent search, chunking, and persistence

export { RagChatService } from "./chat/rag-chat.service";
export {
	RAG_CHAT_TOOLS,
	RagToolExecutor,
	type ToolResult,
} from "./chat/rag-chat-tools";
export {
	type ChatTurn,
	type ContextResolver,
	RagQueryService,
	type ToolCallRecord,
} from "./chat/rag-query.service";
// Context types
export type {
	CardContextItem,
	ContextItem,
	NoteContextItem,
} from "./context/context.types";
export { contextKey } from "./context/context.types";
export type {
	EmbeddingRow,
	RagChunkRow,
	RagIndexMetaRow,
	RagSourceType,
} from "./indexing/rag-chunk-actions";
export { RagChunkActions } from "./indexing/rag-chunk-actions";
export { RagSchemaManager } from "./indexing/rag-schema";
export type { DailyNoteInfo } from "./ingestion/daily-note-preprocessor";
export { preprocessDailyNote } from "./ingestion/daily-note-preprocessor";
export type { RagChunk } from "./ingestion/rag-chunker.service";
export {
	chunkDailyNote,
	chunkFlashcard,
	chunkNote,
} from "./ingestion/rag-chunker.service";
export {
	type KnowledgeEvidence,
	type KnowledgeRetrievalRequest,
	type KnowledgeRetriever,
	type KnowledgeSourceType,
	RagKnowledgeRetriever,
} from "./retrieval/knowledge-retriever";
// Chat services
export { RagEmbeddingServiceImpl } from "./retrieval/rag-embedding.service";
export type {
	GroupedSearchResult,
	RagEmbeddingService,
	SearchOptions,
	SearchResponse,
	SearchResult,
	SearchStats,
} from "./retrieval/rag-search.service";
export { RagSearchService } from "./retrieval/rag-search.service";
// Source grouping
export type { GroupedSource } from "./retrieval/rag-source-grouper";
export { groupSources, stripMarkdown } from "./retrieval/rag-source-grouper";
export { StudyDataGatherer } from "./study/study-data-gatherer";
export {
	classifyIntent,
	type StudyIntent,
} from "./study/study-intent-classifier";
