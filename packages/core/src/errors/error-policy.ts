import { HttpError, isHttpError, isNetworkError } from "./api.error";
import { AppError } from "./base.error";

class UnexpectedError extends AppError {
	constructor(error: unknown) {
		super(describe(error), "unexpected", false, {
			cause: error,
			category: "unexpected",
			severity: "error",
		});
	}
}

export function toAppError(error: unknown): AppError {
	return error instanceof AppError ? error : new UnexpectedError(error);
}

export function isTransient(error: unknown): boolean {
	if (isNetworkError(error)) return error.code !== "aborted";
	if (isHttpError(error)) {
		return (
			error.retryable ??
			(error.statusCode === 408 ||
				error.statusCode === 425 ||
				error.statusCode === 429 ||
				error.statusCode >= 500)
		);
	}
	return false;
}

const claimed = new WeakSet<AppError>();

export function claimErrorReport(error: AppError): boolean {
	if (claimed.has(error)) return false;
	claimed.add(error);
	return true;
}

export function transportContext(error: AppError): Record<string, unknown> {
	if (error instanceof HttpError) {
		return {
			status: error.statusCode,
			backendCode: error.backendCode,
			requestId: error.requestId,
			provider: error.provider,
		};
	}
	return {};
}

function describe(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error) ?? String(error);
	} catch {
		return String(error);
	}
}
