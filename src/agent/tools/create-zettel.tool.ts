/**
 * Create Zettel Tool
 * Creates a new atomic note (Zettel) with optional flashcards
 */
import { z } from "zod";
import { TFile } from "obsidian";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";

const FlashcardSchema = z.object({
	question: z.string().min(1, "Question cannot be empty"),
	answer: z.string().min(1, "Answer cannot be empty"),
});

const InputSchema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string().optional().default("").describe("Markdown content for the note body"),
	folder: z.string().optional().describe("Folder path (defaults to Zettel folder from settings or root)"),
	flashcards: z
		.array(FlashcardSchema)
		.optional()
		.default([])
		.describe("Optional flashcards to create and link to this note"),
	projects: z
		.array(z.string())
		.optional()
		.default([])
		.describe("Project names to assign to created flashcards"),
	tags: z
		.array(z.string())
		.optional()
		.default([])
		.describe("Tags to add to the note frontmatter"),
});

const OutputSchema = z.object({
	filePath: z.string(),
	sourceUid: z.string(),
	flashcardsCreated: z.number(),
	flashcardIds: z.array(z.string()),
});

type CreateZettelInput = z.infer<typeof InputSchema>;
type CreateZettelOutput = z.infer<typeof OutputSchema>;

export const createZettelTool: ToolDefinition<CreateZettelInput, CreateZettelOutput> = {
	name: "create-zettel",
	description:
		"Create a new atomic note (Zettel) with optional flashcards linked to it. Returns the file path and source UID.",
	category: "note",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<CreateZettelOutput>> {
		// Sanitize filename (remove invalid characters)
		const sanitizedTitle = input.title.replace(/[\\/:*?"<>|]/g, "");

		// Determine folder
		const folder = input.folder ?? ctx.settings.zettelFolder ?? "";

		// Build file path
		const filePath = folder
			? `${folder}/${sanitizedTitle}.md`
			: `${sanitizedTitle}.md`;

		// Check if file already exists
		const existingFile = ctx.app.vault.getAbstractFileByPath(filePath);
		if (existingFile) {
			return {
				success: false,
				error: {
					code: "FILE_EXISTS",
					message: `A file already exists at path: ${filePath}`,
				},
			};
		}

		// Ensure folder exists
		if (folder) {
			const folderExists = ctx.app.vault.getAbstractFileByPath(folder);
			if (!folderExists) {
				try {
					await ctx.app.vault.createFolder(folder);
				} catch {
					// Folder might already exist or be created in parallel
				}
			}
		}

		// Generate source UID
		const frontmatterService = ctx.flashcardManager.getFrontmatterService();
		const sourceUid = frontmatterService.generateUid();

		// Build frontmatter
		const frontmatterLines: string[] = ["---"];
		frontmatterLines.push(`flashcard_uid: ${sourceUid}`);
		if (input.tags.length > 0) {
			frontmatterLines.push(`tags: [${input.tags.join(", ")}]`);
		}
		frontmatterLines.push("---");
		frontmatterLines.push("");

		// Build content
		const fileContent = frontmatterLines.join("\n") + (input.content || "");

		try {
			// Create the file
			const file = await ctx.app.vault.create(filePath, fileContent);

			// Create flashcards if provided
			const flashcardIds: string[] = [];
			if (input.flashcards.length > 0) {
				for (const fc of input.flashcards) {
					const card = await ctx.flashcardManager.addSingleFlashcardToSql(
						fc.question,
						fc.answer,
						sourceUid,
						input.projects
					);
					flashcardIds.push(card.id);
				}
			}

			return {
				success: true,
				data: {
					filePath: file.path,
					sourceUid,
					flashcardsCreated: flashcardIds.length,
					flashcardIds,
				},
				meta: {
					eventsEmitted: flashcardIds.length > 0 ? ["card:added"] : [],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "CREATE_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
