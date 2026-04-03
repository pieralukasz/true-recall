import { z } from "zod";

const baseFields = {
	question: z.string().min(1, "Question cannot be empty"),
	answer: z.string().min(1, "Answer cannot be empty"),
	id: z.string().min(1, "Card ID is required"),
	alwaysTypeIn: z.boolean().optional(),
};

const BasicFlashcardSchema = z.object({
	...baseFields,
	cardType: z.literal("basic"),
});

const ClozeFlashcardSchema = z.object({
	...baseFields,
	cardType: z.literal("cloze"),
	clozeTemplate: z.string(),
	clozeIndex: z.number().int().nonnegative(),
});

const ReversedFlashcardSchema = z.object({
	...baseFields,
	cardType: z.literal("reversed"),
	reverseOfBatchId: z.string().optional(),
});

const ImageOcclusionFlashcardSchema = z.object({
	...baseFields,
	cardType: z.literal("image-occlusion"),
});

const NoteReviewFlashcardSchema = z.object({
	...baseFields,
	question: z.string(),
	answer: z.string(),
	cardType: z.literal("note-review"),
});

export const FlashcardItemSchema = z.discriminatedUnion("cardType", [
	BasicFlashcardSchema,
	ClozeFlashcardSchema,
	ReversedFlashcardSchema,
	ImageOcclusionFlashcardSchema,
	NoteReviewFlashcardSchema,
]);

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
