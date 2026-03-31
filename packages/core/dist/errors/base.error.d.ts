/**
 * Base application error class
 */
export declare class AppError extends Error {
    readonly code: string;
    readonly isRecoverable: boolean;
    constructor(message: string, code: string, isRecoverable?: boolean);
    toUserMessage(): string;
}
