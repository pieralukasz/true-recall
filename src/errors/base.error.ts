/**
 * Base application error class
 */
export class AppError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly isRecoverable: boolean = true,
	) {
		super(message);
		this.name = this.constructor.name;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	toUserMessage(): string {
		return this.message;
	}
}
