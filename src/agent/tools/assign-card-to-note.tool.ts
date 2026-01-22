/**
 * Assign Card to Note Tool
 * Assigns an orphaned flashcard to a source note
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const InputSchema = z.object({
	cardId: z.string().min(1, "Card ID is required"),
	targetNotePath: z.string().min(1, "Target note path is required"),
});

const OutputSchema = z.object({
	assigned: z.boolean(),
	cardId: z.string(),
	targetNotePath: z.string(),
});

type AssignCardInput = z.infer<typeof InputSchema>;
type AssignCardOutput = z.infer<typeof OutputSchema>;

export const assignCardToNoteTool: ToolDefinition<
	AssignCardInput,
	AssignCardOutput
> = {
	name: "assign-card-to-note",
	description:
		"Assign an orphaned flashcard (one without a source note) to a specific note. Creates the source note link.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<AssignCardOutput>> {
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
			const assigned = await ctx.flashcardManager.assignCardToSourceNote(
				input.cardId,
				input.targetNotePath
			);

			return {
				success: true,
				data: {
					assigned,
					cardId: input.cardId,
					targetNotePath: input.targetNotePath,
				},
				meta: {
					eventsEmitted: assigned ? ["card:updated"] : [],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "ASSIGN_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
