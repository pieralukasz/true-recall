import type { IFileSystem } from "../../interfaces/file-system";
import type { IFrontmatter } from "../../interfaces/frontmatter";
export declare class FrontmatterService {
    private fileSystem;
    private frontmatter;
    /** Matches YAML frontmatter block */
    private static readonly FRONTMATTER_REGEX;
    /** Matches inline tags: #tag/subtag */
    private static readonly INLINE_TAG_REGEX;
    /** Matches tags array format: tags: [a, b] */
    private static readonly TAGS_ARRAY_REGEX;
    /** Matches tags list format */
    private static readonly TAGS_LIST_REGEX;
    /** Matches source_link field */
    private static readonly SOURCE_LINK_REGEX;
    /** Matches flashcard_uid field */
    private static readonly UID_FIELD_REGEX;
    constructor(fileSystem: IFileSystem, frontmatter: IFrontmatter);
    extractSourceLinkFromContent(content: string): string | null;
    extractAllTags(content: string): string[];
    /** UID field name in source note frontmatter */
    private readonly SOURCE_UID_FIELD;
    /** UID length for generating short IDs */
    private readonly UID_LENGTH;
    /**
     * Generate a short UID for flashcard linking (8 hex chars)
     */
    generateUid(): string;
    getSourceNoteUid(filePath: string | {
        path: string;
    }): Promise<string | null>;
    setSourceNoteUid(filePath: string | {
        path: string;
    }, uid: string): Promise<void>;
    setArchive(filePath: string, archived: boolean): Promise<void>;
    setFsrsPreset(filePath: string, presetName: string | null): Promise<void>;
    addParent(filePath: string, parentName: string): Promise<void>;
    removeParent(filePath: string, parentName: string): Promise<void>;
    /**
     * Remove "# Flashcards for [[...]]" header from content
     * Used for migration of existing files
     */
    removeFlashcardsHeader(content: string): string;
}
