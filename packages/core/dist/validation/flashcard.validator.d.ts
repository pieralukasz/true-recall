import { ValidationError } from "../errors";
import type { FlashcardItem } from "../types";
export type ValidationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: ValidationError;
};
export declare function validateFlashcardItem(data: unknown): FlashcardItem;
export declare function validateFlashcardItems(data: unknown[]): FlashcardItem[];
