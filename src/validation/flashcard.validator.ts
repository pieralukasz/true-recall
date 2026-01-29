/**
 * Validators for flashcard data structures
 */
import {
	FlashcardItemSchema,
} from "./schemas/flashcard.schema";
import type { FlashcardItem } from "../types";
import { ValidationError } from "../errors";

/**
 * Result of validation - either success with data or failure with error
 */
export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; error: ValidationError };

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
		const errors = zodErrors.map(
			(e) => `${e.path.map(String).join(".")}: ${e.message}`
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
