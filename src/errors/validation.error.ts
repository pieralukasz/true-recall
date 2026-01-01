/**
 * Validation-related error classes
 */
import { AppError } from "./base.error";

/**
 * Error thrown when data validation fails
 */
export class ValidationError extends AppError {
    constructor(
        message: string,
        public readonly field?: string,
        public readonly details?: string[]
    ) {
        super(message, "VALIDATION_ERROR", true);
    }

    toUserMessage(): string {
        if (this.field) {
            return `Invalid ${this.field}: ${this.message}`;
        }
        return `Validation error: ${this.message}`;
    }
}

/**
 * Error thrown when required configuration is missing
 */
export class ConfigurationError extends AppError {
    constructor(
        message: string,
        public readonly configKey?: string
    ) {
        super(message, "CONFIGURATION_ERROR", true);
    }

    toUserMessage(): string {
        if (this.configKey) {
            return `Missing configuration: ${this.configKey}. Please check your settings.`;
        }
        return `Configuration error: ${this.message}`;
    }
}

/**
 * Error thrown when a file operation fails
 */
export class FileError extends AppError {
    constructor(
        message: string,
        public readonly filePath?: string,
        public readonly operation?: "read" | "write" | "delete" | "create"
    ) {
        super(message, "FILE_ERROR", true);
    }

    toUserMessage(): string {
        const opName = this.operation
            ? { read: "reading", write: "writing", delete: "deleting", create: "creating" }[this.operation]
            : "accessing";

        if (this.filePath) {
            return `Error ${opName} file: ${this.filePath}`;
        }
        return `File operation error: ${this.message}`;
    }
}
