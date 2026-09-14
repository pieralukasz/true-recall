import {
	claimErrorReport,
	toAppError,
	transportContext,
} from "@true-recall/core/errors";

export interface ErrorReportOptions {
	origin: string;
	context?: Record<string, string | number | boolean>;
}

const claimedInputs = new WeakSet<object>();

export function reportError(
	error: unknown,
	{ origin, context = {} }: ErrorReportOptions,
): void {
	if (isCancellation(error) || !claimInput(error)) return;

	const appError = toAppError(error);
	if (!claimErrorReport(appError)) return;

	const report = {
		origin,
		code: appError.code,
		category: appError.category,
		...appError.context,
		...transportContext(appError),
		...context,
	};
	const cause = appError.cause instanceof Error ? appError.cause : appError;

	if (appError.severity === "info") {
		console.info(`[True Recall] ${appError.message}`, report);
	} else if (appError.severity === "warn") {
		console.warn(`[True Recall] ${appError.message}`, cause, report);
	} else {
		console.error(`[True Recall] ${appError.message}`, cause, report);
	}
}

function claimInput(error: unknown): boolean {
	if (
		(typeof error !== "object" || error === null) &&
		typeof error !== "function"
	) {
		return true;
	}
	if (claimedInputs.has(error)) return false;
	claimedInputs.add(error);
	return true;
}

function isCancellation(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === "AbortError") ||
		(error instanceof Error && error.name === "AbortError")
	);
}
