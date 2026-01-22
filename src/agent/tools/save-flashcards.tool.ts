/**
 * Save Flashcards Tool
 * Saves multiple flashcards to a source note (batch operation)
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const FlashcardSchema = z.object({
	id: z.string().min(1, "Card ID is required"),
	question: z.string().min(1, "Question cannot be empty"),
	answer: z.string().min(1, "Answer cannot be empty"),
});

const InputSchema = z.object({
	sourceNotePath: z.string().min(1, "Source note path is required"),
	flashcards: z.array(FlashcardSchema).min(1, "At least one flashcard is required"),
	projects: z.array(z.string()).optional().default([]),
});

const OutputSchema = z.object({
	saved: z.number(),
	cardIds: z.array(z.string()),
	sourceNotePath: z.string(),
});

type SaveFlashcardsInput = z.infer<typeof InputSchema>;
type SaveFlashcardsOutput = z.infer<typeof OutputSchema>;

export const saveFlashcardsTool: ToolDefinition<
	SaveFlashcardsInput,
	SaveFlashcardsOutput
> = {
	name: "save-flashcards",
	description:
		"Save multiple flashcards to a source note in a single batch operation. Each flashcard must have a unique ID.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<SaveFlashcardsOutput>> {
		// Resolve source file
		const sourceFile = ctx.resolveFile(input.sourceNotePath);
		if (!sourceFile) {
			return {
				success: false,
				error: {
					code: "SOURCE_NOT_FOUND",
					message: `Source note not found: ${input.sourceNotePath}`,
				},
			};
		}

		try {
			const createdCards = await ctx.flashcardManager.saveFlashcardsToSql(
				sourceFile,
				input.flashcards,
				input.projects
			);

			return {
				success: true,
				data: {
					saved: createdCards.length,
					cardIds: createdCards.map((c) => c.id),
					sourceNotePath: input.sourceNotePath,
				},
				meta: {
					eventsEmitted: createdCards.length > 0 ? ["card:added", "cards:bulk-change"] : [],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "SAVE_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
