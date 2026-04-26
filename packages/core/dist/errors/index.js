export { APIError, InvalidResponseError, NetworkError, TimeoutError, } from "./api.error";
export { AppError } from "./base.error";
export { DatabaseError, DuplicateError, NotFoundError, NotInitializedError, } from "./domain.error";
export { ConfigurationError, FileError, ValidationError, } from "./validation.error";
export function isAppError(error) {
    return error instanceof Error && "code" in error && "isRecoverable" in error;
}
export function getErrorMessage(error) {
    if (isAppError(error)) {
        return error.toUserMessage();
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
