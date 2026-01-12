/**
 * Validators for flashcard data structures
 */
import {
    RawFlashcardChangeSchema,
    DiffResponseSchema,
    FlashcardItemSchema,
    type RawFlashcardChange,
} from "./schemas/flashcard.schema";
import type { FlashcardChange, FlashcardItem } from "../types";
import { ValidationError } from "../errors";

/**
 * Result of validation - either success with data or failure with error
 */
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: ValidationError };

/**
 * Validates a single flashcard change from AI response
 *
 * @param data - Raw flashcard change data
 * @returns Validated and transformed FlashcardChange
 * @throws ValidationError if the data is invalid
 */
export function validateFlashcardChange(data: unknown): FlashcardChange {
    const result = RawFlashcardChangeSchema.safeParse(data);

    if (!result.success) {
        // Zod v4 uses 'issues' with PropertyKey[] paths
        const zodErrors = result.error.issues ?? [];
        const errors = zodErrors.map((e) =>
            `${e.path.map(String).join(".")}: ${e.message}`
        );
        throw new ValidationError(
            `Invalid flashcard change: ${errors.join(", ")}`,
            "flashcardChange",
            errors
        );
    }

    // Transform to FlashcardChange with accepted field
    const raw = result.data;
    const change: FlashcardChange = {
        type: raw.type,
        question: raw.question,
        answer: raw.answer,
        originalQuestion: raw.originalQuestion,
        originalAnswer: raw.originalAnswer,
        originalCardId: raw.originalCardId,
        reason: raw.reason,
        accepted: raw.type === "NEW",
    };
    return change;
}

/**
 * Safely validates a flashcard change without throwing
 *
 * @param data - Raw flashcard change data
 * @returns ValidationResult with either the parsed data or null for invalid data
 */
export function safeValidateFlashcardChange(
    data: unknown
): FlashcardChange | null {
    try {
        return validateFlashcardChange(data);
    } catch {
        return null;
    }
}

/**
 * Validates the complete diff response from AI
 *
 * @param data - Raw diff response data
 * @returns Array of validated FlashcardChange objects
 */
export function validateDiffResponse(data: unknown): FlashcardChange[] {
    // First, check if we have a basic object with a changes array
    if (!data || typeof data !== "object") {
        return [];
    }

    const obj = data as Record<string, unknown>;
    const changes = obj.changes;

    if (!Array.isArray(changes)) {
        return [];
    }

    // Validate each change individually and filter out invalid ones
    return changes
        .map((change: unknown) => safeValidateFlashcardChange(change))
        .filter((change): change is FlashcardChange => change !== null);
}

/**
 * Parses JSON string and validates as diff response
 *
 * @param jsonString - JSON string from AI response
 * @returns Array of validated FlashcardChange objects
 */
export function parseDiffJson(jsonString: string): FlashcardChange[] {
    // Try to extract JSON from response (AI might include extra text)
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        // No JSON found - might be empty or "NO_NEW_CARDS"
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(jsonMatch[0]);
        return validateDiffResponse(parsed);
    } catch {
        return [];
    }
}

/**
 * Validates a flashcard item
 *
 * @param data - Raw flashcard item data
 * @returns Validated FlashcardItem
 * @throws ValidationError if the data is invalid
 */
export function validateFlashcardItem(data: unknown): FlashcardItem {
    const result = FlashcardItemSchema.safeParse(data);

    if (!result.success) {
        // Zod v4 uses 'issues' with PropertyKey[] paths
        const zodErrors = result.error.issues ?? [];
        const errors = zodErrors.map((e) =>
            `${e.path.map(String).join(".")}: ${e.message}`
        );
        throw new ValidationError(
            `Invalid flashcard: ${errors.join(", ")}`,
            "flashcard",
            errors
        );
    }

    return result.data;
}

/**
 * Validates an array of flashcard items
 *
 * @param data - Array of raw flashcard item data
 * @returns Array of validated FlashcardItem objects (invalid items are filtered out)
 */
export function validateFlashcardItems(data: unknown[]): FlashcardItem[] {
    return data
        .map((item) => {
            const result = FlashcardItemSchema.safeParse(item);
            return result.success ? result.data : null;
        })
        .filter((item): item is FlashcardItem => item !== null);
}

/**
 * Enriches flashcard changes with data from existing flashcards
 *
 * @param changes - Array of raw flashcard changes
 * @param existingFlashcards - Array of existing flashcard items
 * @returns Enriched FlashcardChange array with originalAnswer and originalCardId filled in
 */
export function enrichFlashcardChanges(
    changes: RawFlashcardChange[],
    existingFlashcards: FlashcardItem[]
): FlashcardChange[] {
    return changes.map((change) => {
        // Build the enriched change explicitly
        const enriched: FlashcardChange = {
            type: change.type,
            question: change.question,
            answer: change.answer,
            originalQuestion: change.originalQuestion,
            originalAnswer: change.originalAnswer,
            originalCardId: change.originalCardId,
            reason: change.reason,
            accepted: change.type === "NEW",
        };

        // For MODIFIED and DELETED, find the original flashcard
        if (
            (change.type === "MODIFIED" || change.type === "DELETED") &&
            change.originalQuestion
        ) {
            const existing = existingFlashcards.find(
                (f) => f.question === change.originalQuestion
            );

            if (existing) {
                enriched.originalAnswer = existing.answer;
                enriched.originalCardId = existing.id;
            }
        }

        // For DELETED, fill in question and answer from existing if not provided
        if (change.type === "DELETED" && change.originalQuestion) {
            const existing = existingFlashcards.find(
                (f) => f.question === change.originalQuestion
            );

            if (existing) {
                if (!enriched.question) enriched.question = existing.question;
                if (!enriched.answer) enriched.answer = existing.answer;
            }
        }

        return enriched;
    });
}
