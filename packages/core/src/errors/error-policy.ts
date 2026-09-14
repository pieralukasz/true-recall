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
	const appError = findAppError(error);
	return appError ?? new UnexpectedError(error);
}

function findAppError(error: unknown): AppError | null {
	const seen = new Set<unknown>();
	let current = error;
	while (current instanceof Error && !seen.has(current)) {
		if (current instanceof AppError) return current;
		seen.add(current);
		current = current.cause;
	}
	return null;
}

export function isTransient(error: unknown): boolean {
	const appError = toAppError(error);
	if (isHttpError(appError)) {
		return (
			appError.retryable ??
			(appError.statusCode === 408 ||
				appError.statusCode === 425 ||
				appError.statusCode === 429 ||
				appError.statusCode >= 500)
		);
	}
	if (isNetworkError(appError)) return appError.code !== "aborted";
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
