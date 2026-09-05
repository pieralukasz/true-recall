import { isHttpError } from "./api.error";
import type { ErrorCategory } from "./base.error";
import { toAppError } from "./error-policy";

const copy: Record<ErrorCategory, string> = {
	"not-found": "The requested item is no longer available.",
	"access-denied": "You do not have access to this operation.",
	"feature-unavailable": "This feature is not available right now.",
	validation: "Check the provided information and try again.",
	"operation-failed": "The operation failed. Please try again.",
	"data-integrity": "True Recall received an unexpected response.",
	network: "Check your internet connection and try again.",
	"server-error": "The service is temporarily unavailable. Please try again.",
	unexpected: "Something went wrong. Please try again.",
};

export function describeErrorForUser(error: unknown): string {
	const appError = toAppError(error);
	if (isHttpError(appError)) {
		if (appError.statusCode === 401)
			return "Authentication expired or the API key is invalid.";
		if (appError.statusCode === 429)
			return "The provider rate limit or usage limit was reached. Try again later.";
	}
	return copy[appError.category];
}
