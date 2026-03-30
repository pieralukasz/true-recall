import { z } from "zod";

export const FlashcardItemSchema = z.object({
	question: z.string().min(1, "Question cannot be empty"),
	answer: z.string().min(1, "Answer cannot be empty"),
	id: z.string().min(1, "Card ID is required"),
	cardType: z
		.enum(["basic", "cloze", "reversed", "image-occlusion"])
		.optional(),
	clozeTemplate: z.string().optional(),
	clozeIndex: z.number().int().nonnegative().optional(),
	reverseOfBatchId: z.string().optional(),
	alwaysTypeIn: z.boolean().optional(),
});

export const FlashcardInfoSchema = z.object({
	exists: z.boolean(),
	filePath: z.string(),
	cardCount: z.number().int().nonnegative(),
	questions: z.array(z.string()),
	flashcards: z.array(FlashcardItemSchema),
	lastModified: z.number().nullable(),
});

// Re-export types from flashcard.types for convenience
export type { FlashcardItem } from "../../types/flashcard.types";

// Zod-inferred type for API validation (includes filePath, differs from domain FlashcardInfo)
export type FlashcardInfoPayload = z.infer<typeof FlashcardInfoSchema>;
