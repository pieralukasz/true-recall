/**
 * API-related error classes
 */
import { AppError } from "./base.error";
/**
 * Error thrown when an API request fails
 */
export declare class APIError extends AppError {
    readonly statusCode?: number | undefined;
    readonly provider: string;
    constructor(message: string, statusCode?: number | undefined, provider?: string);
    toUserMessage(): string;
}
/**
 * Error thrown when a network request fails
 */
export declare class NetworkError extends AppError {
    constructor(message?: string);
    toUserMessage(): string;
}
/**
 * Error thrown when a request times out
 */
export declare class TimeoutError extends AppError {
    readonly timeoutMs?: number | undefined;
    constructor(message?: string, timeoutMs?: number | undefined);
    toUserMessage(): string;
}
/**
 * Error thrown when the API response format is invalid
 */
export declare class InvalidResponseError extends AppError {
    constructor(message?: string);
    toUserMessage(): string;
}
