export {
	slugifyNoteTypeName,
	resolveSlug,
} from "./note-type-slug";

export { FrontmatterService } from "./frontmatter.service";

export {
	type ParsedBlock,
	type NoteTypeLookup,
	parseBlocks,
	blockToText,
	blocksToText,
	countBlocks,
} from "./block-parser.service";

export {
	type ClozeCard,
	hasClozeContent,
	extractClozeIndices,
	renderClozeQuestion,
	renderClozeAnswer,
	parseClozeTemplate,
} from "./cloze-parser.service";

export {
	type ISessionPersistence,
	type DeletionHandlerDeps,
	DeletionHandlerService,
} from "./deletion-handler.service";

export {
	type MigrationResult,
	migrateContent,
	migrateVault,
} from "./migration.service";

export {
	type CollectResult,
	CollectService,
} from "./collect.service";

export {
	type ScanResult,
	type FlashcardInfo,
	type CreateNoteParams,
	type CreateNoteResult,
	type UpdateNoteFieldsResult,
	type ChangeNoteTypeResult,
	type DeleteFlashcardsResult,
	type CreateImageOcclusionNoteParams,
	type UpdateImageOcclusionNoteParams,
	FlashcardManager,
} from "./flashcard.service";

export { CardQueryService } from "./card-query.service";

export {
	INLINE_SEPARATOR_RE,
	CLOZE_DETECT,
} from "./parsing-patterns";

export {
	type DuplicateInfo,
	type CreateBatchResult,
	DuplicateQuestionError,
	CardRepository,
} from "./card-repository.service";

export { SourceNoteService } from "./source-note.service";

export {
	type ParsedCard,
	type BulkParseResult,
	type ParseOptions,
	parseBulkText,
} from "./bulk-card-parser";
