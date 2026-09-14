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
	public readonly category: ErrorCategory;
	public readonly severity: ErrorSeverity;
	public readonly context?: ErrorContext;

	constructor(
		message: string,
		public readonly code: string,
		public readonly isRecoverable: boolean = true,
		options: AppErrorOptions = {},
	) {
		super(message, { cause: options.cause });
		this.name = this.constructor.name;
		this.category = options.category ?? "operation-failed";
		this.severity =
			this.category === "validation" ? "info" : (options.severity ?? "error");
		this.context = options.context;
		v8Error.captureStackTrace?.(this, this.constructor);
	}
}

export const ERROR_CATEGORIES = [
	"not-found",
	"access-denied",
	"feature-unavailable",
	"validation",
	"operation-failed",
	"data-integrity",
	"network",
	"server-error",
	"unexpected",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
export type ErrorSeverity = "info" | "warn" | "error";
export type ErrorContext = Record<string, string | number | boolean>;

export interface AppErrorOptions {
	cause?: unknown;
	context?: ErrorContext;
	category?: ErrorCategory;
	severity?: ErrorSeverity;
}
