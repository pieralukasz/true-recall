/**
 * Error Utilities
 * Provides consistent error message extraction across the application
 */

/**
 * Extract error message from unknown error type
 * Handles Error objects, strings, and other types consistently
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return String(error);
}

