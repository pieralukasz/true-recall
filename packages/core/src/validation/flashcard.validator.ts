import { ValidationError } from "../errors";
import type { FlashcardItem } from "../types";
import { FlashcardItemSchema } from "./schemas/flashcard.schema";

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

	// Load-bearing: the schema's inferred output type doesn't structurally
	// match the hand-written FlashcardItem discriminated union exactly.
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	return result.data as FlashcardItem;
}

export function validateFlashcardItems(data: unknown[]): FlashcardItem[] {
	return data
		.map((item) => {
			const result = FlashcardItemSchema.safeParse(normalizeCardType(item));
			// Same schema/type mismatch as validateFlashcardItem() above.
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			return result.success ? (result.data as FlashcardItem) : null;
		})
		.filter((item): item is FlashcardItem => item !== null);
}
