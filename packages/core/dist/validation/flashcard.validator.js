import { ValidationError } from "../errors";
import { FlashcardItemSchema } from "./schemas/flashcard.schema";
export function validateFlashcardItem(data) {
    var _a;
    const result = FlashcardItemSchema.safeParse(data);
    if (!result.success) {
        // Zod v4 uses 'issues' with PropertyKey[] paths
        const zodErrors = (_a = result.error.issues) !== null && _a !== void 0 ? _a : [];
        const errors = zodErrors.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
        throw new ValidationError(`Invalid flashcard: ${errors.join(", ")}`, "flashcard", errors);
    }
    return result.data;
}
export function validateFlashcardItems(data) {
    return data
        .map((item) => {
        const result = FlashcardItemSchema.safeParse(item);
        return result.success ? result.data : null;
    })
        .filter((item) => item !== null);
}
