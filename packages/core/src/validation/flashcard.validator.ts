import { ValidationError } from "../errors";
import type { FlashcardItem } from "../types";
import { FlashcardItemSchema } from "./schemas/flashcard.schema";

export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; error: ValidationError };

export function validateFlashcardItem(data: unknown): FlashcardItem {
	const result = FlashcardItemSchema.safeParse(data);

	if (!result.success) {
		// Zod v4 uses 'issues' with PropertyKey[] paths
		const zodErrors = result.error.issues ?? [];
		const errors = zodErrors.map(
			(e) => `${e.path.map(String).join(".")}: ${e.message}`,
		);
		throw new ValidationError(
			`Invalid flashcard: ${errors.join(", ")}`,
			"flashcard",
			errors,
		);
	}

	return result.data;
}

export function validateFlashcardItems(data: unknown[]): FlashcardItem[] {
	return data
		.map((item) => {
			const result = FlashcardItemSchema.safeParse(item);
			return result.success ? result.data : null;
		})
		.filter((item): item is FlashcardItem => item !== null);
}
