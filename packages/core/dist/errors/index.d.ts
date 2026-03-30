export { APIError, InvalidResponseError, NetworkError, TimeoutError, } from "./api.error";
export { AppError } from "./base.error";
export { ConfigurationError, FileError, ValidationError, } from "./validation.error";
export declare function isAppError(error: unknown): error is import("./base.error").AppError;
export declare function getErrorMessage(error: unknown): string;
