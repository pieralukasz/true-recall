/**
 * Zod schemas for flashcard data structures
 */
import { z } from "zod";

// ===== Flashcard Change Type =====

/**
 * Schema for flashcard change types
 */
export const FlashcardChangeTypeSchema = z.enum(["NEW", "MODIFIED", "DELETED"]);

// ===== Flashcard Item Schema =====

/**
 * Schema for a single flashcard
 */
export const FlashcardItemSchema = z.object({
    question: z.string().min(1, "Question cannot be empty"),
    answer: z.string().min(1, "Answer cannot be empty"),
    ankiId: z.number().int().nullable(),
    lineNumber: z.number().int().positive("Line number must be positive"),
});

// ===== Flashcard Change Schemas =====

/**
 * Base schema for flashcard changes from AI
 */
const FlashcardChangeBaseSchema = z.object({
    type: FlashcardChangeTypeSchema,
    question: z.string().min(1, "Question cannot be empty"),
    answer: z.string(),
    originalQuestion: z.string().optional(),
    originalAnswer: z.string().optional(),
    originalLineNumber: z.number().int().positive().optional(),
    reason: z.string().optional(),
});

/**
 * Schema for NEW flashcard change
 */
export const NewFlashcardChangeSchema = FlashcardChangeBaseSchema.extend({
    type: z.literal("NEW"),
    answer: z.string().min(1, "Answer cannot be empty"),
});

/**
 * Schema for MODIFIED flashcard change
 */
export const ModifiedFlashcardChangeSchema = FlashcardChangeBaseSchema.extend({
    type: z.literal("MODIFIED"),
    answer: z.string().min(1, "Answer cannot be empty"),
    originalQuestion: z.string().min(1, "Original question is required for modified flashcards"),
});

/**
 * Schema for DELETED flashcard change
 */
export const DeletedFlashcardChangeSchema = FlashcardChangeBaseSchema.extend({
    type: z.literal("DELETED"),
    originalQuestion: z.string().min(1, "Original question is required for deleted flashcards"),
    reason: z.string().optional(),
});

/**
 * Schema for any flashcard change (discriminated union)
 */
export const FlashcardChangeSchema = z.discriminatedUnion("type", [
    NewFlashcardChangeSchema,
    ModifiedFlashcardChangeSchema,
    DeletedFlashcardChangeSchema,
]).transform((data) => ({
    ...data,
    // Set default accepted value based on type
    accepted: data.type === "NEW" ? true : false,
}));

/**
 * Schema for raw flashcard change from AI (before transformation)
 * More lenient for parsing AI responses
 */
export const RawFlashcardChangeSchema = z.object({
    type: FlashcardChangeTypeSchema,
    question: z.string().default(""),
    answer: z.string().default(""),
    originalQuestion: z.string().optional(),
    originalAnswer: z.string().optional(),
    originalLineNumber: z.number().int().positive().optional(),
    reason: z.string().optional(),
});

// ===== Diff Response Schema =====

/**
 * Schema for the AI diff response
 */
export const DiffResponseSchema = z.object({
    changes: z.array(RawFlashcardChangeSchema),
});

// ===== Flashcard Info Schema =====

/**
 * Schema for flashcard file information
 */
export const FlashcardInfoSchema = z.object({
    exists: z.boolean(),
    filePath: z.string(),
    cardCount: z.number().int().nonnegative(),
    questions: z.array(z.string()),
    flashcards: z.array(FlashcardItemSchema),
    lastModified: z.number().nullable(),
});

// ===== Inferred Types from Schemas =====

export type FlashcardChangeType = z.infer<typeof FlashcardChangeTypeSchema>;
export type FlashcardItem = z.infer<typeof FlashcardItemSchema>;
export type RawFlashcardChange = z.infer<typeof RawFlashcardChangeSchema>;
export type DiffResponse = z.infer<typeof DiffResponseSchema>;
export type FlashcardInfo = z.infer<typeof FlashcardInfoSchema>;

// Simple FlashcardChange interface (not discriminated union for easier use)
export interface FlashcardChange {
    type: FlashcardChangeType;
    question: string;
    answer: string;
    originalQuestion?: string;
    originalAnswer?: string;
    originalLineNumber?: number;
    reason?: string;
    accepted: boolean;
}
