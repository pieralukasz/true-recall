/**
 * Delete Flashcard Tool
 * Removes a flashcard by its ID
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const InputSchema = z.object({
	cardId: z.string().min(1, "Card ID is required"),
});

const OutputSchema = z.object({
	deleted: z.boolean(),
	cardId: z.string(),
});

type DeleteFlashcardInput = z.infer<typeof InputSchema>;
type DeleteFlashcardOutput = z.infer<typeof OutputSchema>;

export const deleteFlashcardTool: ToolDefinition<
	DeleteFlashcardInput,
	DeleteFlashcardOutput
> = {
	name: "delete-flashcard",
	description: "Delete a flashcard by its ID. Returns whether the deletion was successful.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<DeleteFlashcardOutput>> {
		// Check if card exists
		const existingCard = ctx.cardStore.get(input.cardId);
		if (!existingCard) {
			return {
				success: false,
				error: {
					code: "CARD_NOT_FOUND",
					message: `Card with ID "${input.cardId}" not found`,
				},
			};
		}

		try {
			const deleted = await ctx.flashcardManager.removeFlashcardById(input.cardId);

			return {
				success: true,
				data: {
					deleted,
					cardId: input.cardId,
				},
				meta: {
					eventsEmitted: deleted ? ["card:removed"] : [],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "DELETE_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
