export {
	APIError,
	HttpError,
	type HttpErrorOptions,
	InvalidResponseError,
	isHttpError,
	isNetworkError,
	NETWORK_ERROR_CODES,
	NetworkError,
	type NetworkErrorCode,
	TimeoutError,
	type ValidationFieldIssues,
} from "./api.error";
export {
	AppError,
	type AppErrorOptions,
	ERROR_CATEGORIES,
	type ErrorCategory,
	type ErrorContext,
	type ErrorSeverity,
} from "./base.error";
export {
	DatabaseError,
	DomainError,
	type DomainErrorDefinition,
	type DomainErrorRegistry,
	DuplicateError,
	NotFoundError,
	NotInitializedError,
} from "./domain.error";
export {
	claimErrorReport,
	isTransient,
	toAppError,
	transportContext,
} from "./error-policy";
export {
	fromHttpResponse,
	type HttpFailureContext,
} from "./from-http-response";
export { describeErrorForUser } from "./user-facing";
export {
	ConfigurationError,
	FileError,
	ValidationError,
} from "./validation.error";

export function isAppError(
	error: unknown,
): error is import("./base.error").AppError {
	return error instanceof Error && "code" in error && "isRecoverable" in error;
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
