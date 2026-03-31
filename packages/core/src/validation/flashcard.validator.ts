import { ValidationError } from "../errors";
import type { FlashcardItem } from "../types";
import { FlashcardItemSchema } from "./schemas/flashcard.schema";

export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; error: ValidationError };

/** Default missing/falsy cardType to "basic" so the discriminated union can match. */
function normalizeCardType(data: unknown): unknown {
	if (
		typeof data === "object" &&
		data !== null &&
		!("cardType" in data && (data as Record<string, unknown>).cardType)
	) {
		return { ...data, cardType: "basic" };
	}
	return data;
}

export function validateFlashcardItem(data: unknown): FlashcardItem {
	const result = FlashcardItemSchema.safeParse(normalizeCardType(data));

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

	return result.data as FlashcardItem;
}

export function validateFlashcardItems(data: unknown[]): FlashcardItem[] {
	return data
		.map((item) => {
			const result = FlashcardItemSchema.safeParse(normalizeCardType(item));
			return result.success ? (result.data as FlashcardItem) : null;
		})
		.filter((item): item is FlashcardItem => item !== null);
}
