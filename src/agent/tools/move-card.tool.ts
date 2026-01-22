/**
 * Move Card Tool
 * Moves a flashcard to a different source note
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const InputSchema = z.object({
	cardId: z.string().min(1, "Card ID is required"),
	targetNotePath: z.string().min(1, "Target note path is required"),
});

const OutputSchema = z.object({
	moved: z.boolean(),
	cardId: z.string(),
	targetNotePath: z.string(),
});

type MoveCardInput = z.infer<typeof InputSchema>;
type MoveCardOutput = z.infer<typeof OutputSchema>;

export const moveCardTool: ToolDefinition<MoveCardInput, MoveCardOutput> = {
	name: "move-card",
	description:
		"Move a flashcard to a different source note. The card will be linked to the new note.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<MoveCardOutput>> {
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

		// Check if target note exists
		const targetFile = ctx.resolveFile(input.targetNotePath);
		if (!targetFile) {
			return {
				success: false,
				error: {
					code: "TARGET_NOT_FOUND",
					message: `Target note not found: ${input.targetNotePath}`,
				},
			};
		}

		try {
			// moveCard expects (cardId, sourceFilePath, targetNotePath)
			// sourceFilePath is not used internally, so we pass empty string
			const moved = await ctx.flashcardManager.moveCard(
				input.cardId,
				"",
				input.targetNotePath
			);

			return {
				success: true,
				data: {
					moved,
					cardId: input.cardId,
					targetNotePath: input.targetNotePath,
				},
				meta: {
					eventsEmitted: moved ? ["card:updated"] : [],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "MOVE_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
