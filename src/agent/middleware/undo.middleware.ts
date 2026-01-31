/**
 * Undo Middleware
 *
 * Captures state before mutating operations for undo support.
 * Automatically pushes undo entries on successful tool execution.
 */
import type { ToolMiddleware } from "./types";
import type { UndoService } from "../../services/undo";
import type {
	UndoEntry,
	CreateUndoPayload,
	UpdateUndoPayload,
	DeleteUndoPayload,
	BatchCreateUndoPayload,
} from "../../services/undo";
import type { SqliteStoreService } from "../../services/persistence/sqlite/SqliteStoreService";

/**
 * Create undo middleware with lazy service resolution
 * @param getUndoService - Function that returns UndoService (lazy to handle initialization order)
 * @param getCardStore - Function that returns card store for capturing state
 */
export function createUndoMiddleware(
	getUndoService: () => UndoService | undefined,
	getCardStore: () => SqliteStoreService | undefined
): ToolMiddleware {
	return async (ctx, next) => {
		const { tool, args, executionId } = ctx;

		// Skip non-mutating tools
		if (!tool.mutates) {
			return next();
		}

		const undoService = getUndoService();
		const cardStore = getCardStore();

		// Skip if undo service not available
		if (!undoService) {
			return next();
		}

		// Capture undo state before execution
		const undoEntry = captureUndoState(tool.name, args, executionId, cardStore);

		// Execute the tool
		const result = await next();

		// Push undo entry on success
		if (result.success && undoEntry) {
			// Update cardId for create operations (ID not known until after execution)
			if (tool.name === "create-flashcard" && result.data) {
				const data = result.data as { id?: string };
				if (data.id) {
					(undoEntry.payload as CreateUndoPayload).cardId = data.id;
				}
			}

			// Update cardIds for batch create operations
			if (tool.name === "save-flashcards" && result.data) {
				const data = result.data as { cardIds?: string[] };
				if (data.cardIds) {
					(undoEntry.payload as BatchCreateUndoPayload).cardIds = data.cardIds;
				}
			}

			undoService.push(undoEntry);
		}

		return result;
	};
}

/**
 * Capture undo state before a mutating operation
 */
function captureUndoState(
	toolName: string,
	args: Record<string, unknown>,
	executionId: string,
	cardStore: SqliteStoreService | undefined
): UndoEntry | null {
	const timestamp = Date.now();

	switch (toolName) {
		case "create-flashcard":
			return {
				id: executionId,
				actionType: "create-flashcard",
				description: "Create flashcard",
				timestamp,
				payload: { type: "create", cardId: "" } as CreateUndoPayload,
			};

		case "update-card": {
			const cardId = args.cardId as string;
			const existing = cardStore?.get(cardId);
			if (!existing) return null;
			return {
				id: executionId,
				actionType: "update-card",
				description: "Edit flashcard",
				timestamp,
				payload: {
					type: "update",
					cardId,
					previousQuestion: existing.question ?? "",
					previousAnswer: existing.answer ?? "",
				} as UpdateUndoPayload,
			};
		}

		case "delete-flashcard": {
			const cardId = args.cardId as string;
			const existing = cardStore?.get(cardId);
			if (!existing) return null;
			return {
				id: executionId,
				actionType: "delete-flashcard",
				description: "Delete flashcard",
				timestamp,
				payload: {
					type: "delete",
					cardData: { ...existing },
				} as DeleteUndoPayload,
			};
		}

		case "save-flashcards":
			return {
				id: executionId,
				actionType: "save-flashcards",
				description: "Create flashcards",
				timestamp,
				payload: { type: "batch-create", cardIds: [] } as BatchCreateUndoPayload,
			};

		default:
			// Other mutating tools don't support undo yet
			return null;
	}
}
