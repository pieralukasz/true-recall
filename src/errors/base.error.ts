/**
 * Base application error class
 */
export class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly isRecoverable: boolean = true
    ) {
        super(message);
        this.name = this.constructor.name;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Returns a user-friendly error message
     */
    toUserMessage(): string {
        return this.message;
    }
}
