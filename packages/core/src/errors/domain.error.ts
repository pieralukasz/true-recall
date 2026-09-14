import {
	AppError,
	type AppErrorOptions,
	type ErrorCategory,
	type ErrorSeverity,
} from "./base.error";

export interface DomainErrorDefinition {
	category: ErrorCategory;
	severity: ErrorSeverity;
	recoverable?: boolean;
}

export type DomainErrorRegistry = Record<string, DomainErrorDefinition>;

export class DomainError<TCode extends string = string> extends AppError {
	override readonly code: TCode;

	constructor(
		registry: DomainErrorRegistry,
		code: TCode,
		options: AppErrorOptions = {},
	) {
		const definition = registry[code];
		if (!definition) throw new Error(`Unknown domain error code: ${code}`);
		super(
			`[${definition.category}] ${code}`,
			code,
			definition.recoverable ?? true,
			{
				...options,
				category: definition.category,
				severity: definition.severity,
			},
		);
		this.code = code;
	}
}

/** Thrown when an entity is not found (card, note, note type, etc.) */
export class NotFoundError extends AppError {
	constructor(
		entity: string,
		public readonly id?: string,
	) {
		super(
			id ? `${entity} "${id}" not found` : `${entity} not found`,
			"NOT_FOUND",
			true,
			{ category: "not-found", severity: "warn" },
		);
	}
}

/** Thrown when a database operation fails */
export class DatabaseError extends AppError {
	constructor(
		message: string,
		public readonly operation?: string,
		options: AppErrorOptions = {},
	) {
		super(message, "database-error", false, {
			...options,
			category: "data-integrity",
			severity: "error",
		});
	}
}

/** Thrown when a required service or store is not initialized */
export class NotInitializedError extends AppError {
	constructor(service: string = "Store") {
		super(`${service} not initialized`, "not-initialized", false, {
			category: "feature-unavailable",
			severity: "error",
		});
	}
}

/** Thrown when a duplicate entity is detected */
export class DuplicateError extends AppError {
	constructor(
		message: string,
		public readonly existingId?: string,
	) {
		super(message, "duplicate", true, {
			category: "validation",
			severity: "info",
		});
	}
}
