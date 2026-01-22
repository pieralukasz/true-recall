/**
 * Create Flashcard Tool
 * Creates a new flashcard linked to a source note
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const InputSchema = z.object({
	question: z.string().min(1, "Question cannot be empty"),
	answer: z.string().min(1, "Answer cannot be empty"),
	sourceNotePath: z
		.string()
		.optional()
		.describe("Path to the source note. If not provided, uses active note."),
	useActiveNote: z
		.boolean()
		.optional()
		.default(false)
		.describe("Use the currently active note as source"),
	projects: z
		.array(z.string())
		.optional()
		.default([])
		.describe("Project names to assign to the card"),
});

const OutputSchema = z.object({
	id: z.string(),
	question: z.string(),
	answer: z.string(),
	sourceUid: z.string().optional(),
	sourceNoteName: z.string().optional(),
});

type CreateFlashcardInput = z.infer<typeof InputSchema>;
type CreateFlashcardOutput = z.infer<typeof OutputSchema>;

export const createFlashcardTool: ToolDefinition<
	CreateFlashcardInput,
	CreateFlashcardOutput
> = {
	name: "create-flashcard",
	description:
		"Create a new flashcard. Provide sourceNotePath or set useActiveNote=true to link it to a source note.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(
		input,
		ctx
	): Promise<ToolResult<CreateFlashcardOutput>> {
		// Resolve source file
		let sourceFile = null;
		if (input.useActiveNote) {
			sourceFile = ctx.getActiveFile();
		} else if (input.sourceNotePath) {
			sourceFile = ctx.resolveFile(input.sourceNotePath);
		}

		// Get source UID if we have a source file
		let sourceUid: string | undefined;
		if (sourceFile) {
			const frontmatterService =
				ctx.flashcardManager.getFrontmatterService();
			sourceUid =
				(await frontmatterService.getSourceNoteUid(sourceFile)) ?? undefined;

			// If no UID exists, create one
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
			}
		}

		try {
			const card = await ctx.flashcardManager.addSingleFlashcardToSql(
				input.question,
				input.answer,
				sourceUid,
				input.projects
			);

			return {
				success: true,
				data: {
					id: card.id,
					question: card.question,
					answer: card.answer,
					sourceUid: card.sourceUid,
					sourceNoteName: card.sourceNoteName,
				},
				meta: {
					eventsEmitted: ["card:added"],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "CREATE_FAILED",
					message:
						error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
