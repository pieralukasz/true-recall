/**
 * Validation-related error classes
 */
import { AppError } from "./base.error";
/**
 * Error thrown when data validation fails
 */
export declare class ValidationError extends AppError {
    readonly field?: string | undefined;
    readonly details?: string[] | undefined;
    constructor(message: string, field?: string | undefined, details?: string[] | undefined);
    toUserMessage(): string;
}
/**
 * Error thrown when required configuration is missing
 */
export declare class ConfigurationError extends AppError {
    readonly configKey?: string | undefined;
    constructor(message: string, configKey?: string | undefined);
    toUserMessage(): string;
}
/**
 * Error thrown when a file operation fails
 */
export declare class FileError extends AppError {
    readonly filePath?: string | undefined;
    readonly operation?: "read" | "write" | "delete" | "create" | undefined;
    constructor(message: string, filePath?: string | undefined, operation?: "read" | "write" | "delete" | "create" | undefined);
    toUserMessage(): string;
}
