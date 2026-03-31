/**
 * Migrates inline `Front :: Back` flashcard lines in notes to the new block format.
 *
 * For each note containing inline flashcards:
 * 1. Detect `Front :: Back` and standalone cloze lines
 * 2. Convert to block format (#type/basic, #type/cloze, etc.)
 * 3. Replace the old lines in the note content
 */
import type { IFileSystem } from "@true-recall/core/interfaces/file-system";
export interface MigrationResult {
    migratedFiles: number;
    migratedCards: number;
    errors: string[];
}
/**
 * Migrate a single note's content from :: format to block format.
 * Returns the transformed content, or null if no changes were needed.
 */
export declare function migrateContent(content: string): string | null;
/**
 * Migrate all notes in the vault from :: format to block format.
 */
export declare function migrateVault(fileSystem: IFileSystem): Promise<MigrationResult>;
