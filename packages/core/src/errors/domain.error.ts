import { AppError } from "./base.error";

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
		);
	}

	toUserMessage(): string {
		return this.message;
	}
}

/** Thrown when a database operation fails */
export class DatabaseError extends AppError {
	constructor(
		message: string,
		public readonly operation?: string,
	) {
		super(message, "DATABASE_ERROR", false);
	}

	toUserMessage(): string {
		return `Database error: ${this.message}`;
	}
}

/** Thrown when a required service or store is not initialized */
export class NotInitializedError extends AppError {
	constructor(service: string = "Store") {
		super(`${service} not initialized`, "NOT_INITIALIZED", false);
	}

	toUserMessage(): string {
		return this.message;
	}
}

/** Thrown when a duplicate entity is detected */
export class DuplicateError extends AppError {
	constructor(
		message: string,
		public readonly existingId?: string,
	) {
		super(message, "DUPLICATE", true);
	}

	toUserMessage(): string {
		return this.message;
	}
}
