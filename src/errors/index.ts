/**
 * Central export point for all error classes
 */

// Base error
export { AppError } from "./base.error";

// API errors
export {
    APIError,
    NetworkError,
    TimeoutError,
    InvalidResponseError,
} from "./api.error";

// Validation errors
export {
    ValidationError,
    ConfigurationError,
    FileError,
} from "./validation.error";

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is import("./base.error").AppError {
    return error instanceof Error && "code" in error && "isRecoverable" in error;
}

/**
 * Extract user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
    if (isAppError(error)) {
        return error.toUserMessage();
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
