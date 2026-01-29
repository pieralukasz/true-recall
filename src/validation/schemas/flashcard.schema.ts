/**
 * Zod schemas for flashcard data structures
 */
import { z } from "zod";
import type { FlashcardItem } from "../../types/flashcard.types";

// ===== Flashcard Item Schema =====

/**
 * Schema for a single flashcard
 */
export const FlashcardItemSchema = z.object({
    question: z.string().min(1, "Question cannot be empty"),
    answer: z.string().min(1, "Answer cannot be empty"),
    id: z.string().min(1, "Card ID is required"),
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

// Re-export types from flashcard.types for convenience
export type { FlashcardItem } from "../../types/flashcard.types";

// Types that are specific to validation
export type FlashcardInfo = z.infer<typeof FlashcardInfoSchema>;
