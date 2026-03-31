/**
 * Validation-related error classes
 */
import { AppError } from "./base.error";
/**
 * Error thrown when data validation fails
 */
export class ValidationError extends AppError {
    constructor(message, field, details) {
        super(message, "VALIDATION_ERROR", true);
        this.field = field;
        this.details = details;
    }
    toUserMessage() {
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
    constructor(message, configKey) {
        super(message, "CONFIGURATION_ERROR", true);
        this.configKey = configKey;
    }
    toUserMessage() {
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
    constructor(message, filePath, operation) {
        super(message, "FILE_ERROR", true);
        this.filePath = filePath;
        this.operation = operation;
    }
    toUserMessage() {
        const opName = this.operation
            ? {
                read: "reading",
                write: "writing",
                delete: "deleting",
                create: "creating",
            }[this.operation]
            : "accessing";
        if (this.filePath) {
            return `Error ${opName} file: ${this.filePath}`;
        }
        return `File operation error: ${this.message}`;
    }
}
