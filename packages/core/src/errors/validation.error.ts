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
		public readonly details?: string[],
	) {
		super(message, "validation-error", true, {
			category: "validation",
			severity: "info",
		});
	}
}

/**
 * Error thrown when required configuration is missing
 */
export class ConfigurationError extends AppError {
	constructor(
		message: string,
		public readonly configKey?: string,
	) {
		super(message, "configuration-error", true, {
			category: "feature-unavailable",
			severity: "info",
		});
	}
}

/**
 * Error thrown when a file operation fails
 */
export class FileError extends AppError {
	constructor(
		message: string,
		public readonly filePath?: string,
		public readonly operation?: "read" | "write" | "delete" | "create",
	) {
		super(message, "file-error", true, {
			category: "operation-failed",
			severity: "error",
		});
	}
}
