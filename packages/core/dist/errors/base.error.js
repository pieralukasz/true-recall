/**
 * Base application error class
 */
export class AppError extends Error {
    constructor(message, code, isRecoverable = true) {
        super(message);
        this.code = code;
        this.isRecoverable = isRecoverable;
        this.name = this.constructor.name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    toUserMessage() {
        return this.message;
    }
}
