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
