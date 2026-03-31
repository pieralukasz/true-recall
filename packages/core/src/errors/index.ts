export {
	APIError,
	InvalidResponseError,
	NetworkError,
	TimeoutError,
} from "./api.error";
export { AppError } from "./base.error";

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
	if (isAppError(error)) {
		return error.toUserMessage();
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
