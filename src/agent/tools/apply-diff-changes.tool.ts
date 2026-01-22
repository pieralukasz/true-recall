/**
 * Apply Diff Changes Tool
 * Applies AI-generated diff changes (NEW/MODIFIED/DELETED) to flashcards
 */
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types";
import type { FlashcardChange, FlashcardItem } from "../../types";

const FlashcardChangeSchema = z.object({
	type: z.enum(["NEW", "MODIFIED", "DELETED"]),
	question: z.string(),
	answer: z.string(),
	originalQuestion: z.string().optional(),
	originalAnswer: z.string().optional(),
	originalCardId: z.string().optional(),
	reason: z.string().optional(),
	accepted: z.boolean(),
});

const ExistingFlashcardSchema = z.object({
	id: z.string(),
	question: z.string(),
	answer: z.string(),
});

const InputSchema = z.object({
	sourceNotePath: z.string().min(1, "Source note path is required"),
	changes: z.array(FlashcardChangeSchema).min(1, "At least one change is required"),
	existingFlashcards: z.array(ExistingFlashcardSchema).optional().default([]),
});

const OutputSchema = z.object({
	applied: z.number(),
	created: z.number(),
	modified: z.number(),
	deleted: z.number(),
	sourceNotePath: z.string(),
});

type ApplyDiffInput = z.infer<typeof InputSchema>;
type ApplyDiffOutput = z.infer<typeof OutputSchema>;

export const applyDiffChangesTool: ToolDefinition<ApplyDiffInput, ApplyDiffOutput> = {
	name: "apply-diff-changes",
	description:
		"Apply AI-generated diff changes to flashcards. Changes can be NEW (create), MODIFIED (update), or DELETED (remove). Only changes with accepted=true are applied.",
	category: "flashcard",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
	mutates: true,

	async execute(input, ctx): Promise<ToolResult<ApplyDiffOutput>> {
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

		// Count changes by type (only accepted)
		const acceptedChanges = input.changes.filter((c) => c.accepted);
		const created = acceptedChanges.filter((c) => c.type === "NEW").length;
		const modified = acceptedChanges.filter((c) => c.type === "MODIFIED").length;
		const deleted = acceptedChanges.filter((c) => c.type === "DELETED").length;

		if (acceptedChanges.length === 0) {
			return {
				success: true,
				data: {
					applied: 0,
					created: 0,
					modified: 0,
					deleted: 0,
					sourceNotePath: input.sourceNotePath,
				},
			};
		}

		try {
			// Convert to FlashcardChange type (with accepted boolean)
			const changes: FlashcardChange[] = input.changes.map((c) => ({
				type: c.type,
				question: c.question,
				answer: c.answer,
				originalQuestion: c.originalQuestion,
				originalAnswer: c.originalAnswer,
				originalCardId: c.originalCardId,
				reason: c.reason,
				accepted: c.accepted,
			}));

			// Convert existing flashcards
			const existingFlashcards: FlashcardItem[] = input.existingFlashcards.map((f) => ({
				id: f.id,
				question: f.question,
				answer: f.answer,
			}));

			await ctx.flashcardManager.applyDiffChanges(
				sourceFile,
				changes,
				existingFlashcards
			);

			return {
				success: true,
				data: {
					applied: acceptedChanges.length,
					created,
					modified,
					deleted,
					sourceNotePath: input.sourceNotePath,
				},
				meta: {
					eventsEmitted: ["cards:bulk-change"],
				},
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "APPLY_DIFF_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};
