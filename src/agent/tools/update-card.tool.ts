/**
 * Update Card Tool
 * Updates question and/or answer of an existing flashcard
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const InputSchema = z.object({
	cardId: z.string().min(1, "Card ID is required"),
	newQuestion: z.string().min(1, "Question cannot be empty").optional(),
	newAnswer: z.string().min(1, "Answer cannot be empty").optional(),
}).refine(
	(data) => data.newQuestion !== undefined || data.newAnswer !== undefined,
	{ message: "At least one of newQuestion or newAnswer must be provided" }
);

const OutputSchema = z.object({
	id: z.string(),
	question: z.string(),
	answer: z.string(),
	updated: z.boolean(),
});

type UpdateCardInput = z.infer<typeof InputSchema>;
type UpdateCardOutput = z.infer<typeof OutputSchema>;

export const updateCardTool: ToolDefinition<UpdateCardInput, UpdateCardOutput> = {
	name: "update-card",
	description:
		"Update the question and/or answer of an existing flashcard by its ID.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<UpdateCardOutput>> {
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

		// Validate that card has question and answer
		if (!existingCard.question || !existingCard.answer) {
			return {
				success: false,
				error: {
					code: "INVALID_CARD",
					message: "Card is missing question or answer data",
				},
			};
		}

		// Determine new values
		const newQuestion = input.newQuestion ?? existingCard.question;
		const newAnswer = input.newAnswer ?? existingCard.answer;

		// Check if there are actual changes
		if (
			newQuestion === existingCard.question &&
			newAnswer === existingCard.answer
		) {
			return {
				success: true,
				data: {
					id: input.cardId,
					question: newQuestion,
					answer: newAnswer,
					updated: false,
				},
			};
		}

		try {
			ctx.flashcardManager.updateCardContent(
				input.cardId,
				newQuestion,
				newAnswer
			);

			return {
				success: true,
				data: {
					id: input.cardId,
					question: newQuestion,
					answer: newAnswer,
					updated: true,
				},
				meta: {
					eventsEmitted: ["card:updated"],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "UPDATE_FAILED",
					message:
						error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
