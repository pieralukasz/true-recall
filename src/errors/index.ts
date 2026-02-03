export { AppError } from "./base.error";


export {
    APIError,
    NetworkError,
    TimeoutError,
    InvalidResponseError,
} from "./api.error";


export {
    ValidationError,
    ConfigurationError,
    FileError,
} from "./validation.error";

export function isAppError(error: unknown): error is import("./base.error").AppError {
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
