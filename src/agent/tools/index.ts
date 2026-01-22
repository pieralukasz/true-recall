/**
 * Tools Index
 * Registers all tools with the ToolRegistry
 */
import { getToolRegistry } from "../registry";

// Import tools
import { createFlashcardTool } from "./create-flashcard.tool";
import { createZettelTool } from "./create-zettel.tool";
import { searchVaultTool } from "./search-vault.tool";
import { updateCardTool } from "./update-card.tool";
import { deleteFlashcardTool } from "./delete-flashcard.tool";
import { moveCardTool } from "./move-card.tool";
import { assignCardToNoteTool } from "./assign-card-to-note.tool";
import { saveFlashcardsTool } from "./save-flashcards.tool";
import { applyDiffChangesTool } from "./apply-diff-changes.tool";

/**
 * Register all tools with the registry
 * Call this during plugin initialization
 */
export function registerAllTools(): void {
	const registry = getToolRegistry();

	// Flashcard CRUD tools
	registry.register(createFlashcardTool);
	registry.register(updateCardTool);
	registry.register(deleteFlashcardTool);

	// Flashcard organization tools
	registry.register(moveCardTool);
	registry.register(assignCardToNoteTool);

	// Batch operations
	registry.register(saveFlashcardsTool);
	registry.register(applyDiffChangesTool);

	// Note tools
	registry.register(createZettelTool);

	// Query tools
	registry.register(searchVaultTool);
}

// Re-export tools for direct use
export { createFlashcardTool } from "./create-flashcard.tool";
export { createZettelTool } from "./create-zettel.tool";
export { searchVaultTool } from "./search-vault.tool";
export { updateCardTool } from "./update-card.tool";
export { deleteFlashcardTool } from "./delete-flashcard.tool";
export { moveCardTool } from "./move-card.tool";
export { assignCardToNoteTool } from "./assign-card-to-note.tool";
export { saveFlashcardsTool } from "./save-flashcards.tool";
export { applyDiffChangesTool } from "./apply-diff-changes.tool";
