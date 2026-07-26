/**
 * `Error.captureStackTrace` is a V8-only extension. Type it locally so this
 * platform-agnostic package does not rely on `@types/node` being present.
 */
const v8Error = Error as ErrorConstructor & {
	captureStackTrace?: (target: object, constructorOpt?: unknown) => void;
};

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
		v8Error.captureStackTrace?.(this, this.constructor);
	}

	toUserMessage(): string {
		return this.message;
	}
}
