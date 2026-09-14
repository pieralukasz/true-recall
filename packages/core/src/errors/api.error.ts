/**
 * API-related error classes
 */
import { AppError, type AppErrorOptions } from "./base.error";

export interface ValidationFieldIssues {
	[field: string]: string[];
}

export interface HttpErrorOptions extends AppErrorOptions {
	backendCode?: string;
	detail?: string;
	validation?: ValidationFieldIssues;
	requestId?: string;
	retryable?: boolean;
	provider?: string;
}

export class HttpError extends AppError {
	readonly backendCode?: string;
	readonly detail?: string;
	readonly validation?: ValidationFieldIssues;
	readonly requestId?: string;
	readonly retryable?: boolean;
	readonly provider?: string;

	constructor(
		public readonly statusCode: number,
		options: HttpErrorOptions = {},
	) {
		const hasValidation = options.validation !== undefined;
		super(
			`HTTP ${statusCode}${options.backendCode ? ` (${options.backendCode})` : ""}`,
			options.backendCode ?? `http-${statusCode}`,
			options.retryable ?? isRetryableStatus(statusCode),
			{
				...options,
				category: categoryForStatus(statusCode, hasValidation),
				severity: severityForStatus(statusCode, hasValidation),
			},
		);
		this.backendCode = options.backendCode;
		this.detail = options.detail;
		this.validation = options.validation;
		this.requestId = options.requestId;
		this.retryable = options.retryable;
		this.provider = options.provider;
	}
}

export function isHttpError(error: unknown): error is HttpError {
	return error instanceof HttpError;
}

/**
 * Error thrown when an API request fails
 */
export class APIError extends AppError {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly provider: string = "Unknown",
	) {
		super(message, "api-error", true, {
			category: statusCode
				? categoryForStatus(statusCode, false)
				: "operation-failed",
			severity: statusCode ? severityForStatus(statusCode, false) : "error",
		});
	}
}

/**
 * Error thrown when a network request fails
 */
export const NETWORK_ERROR_CODES = [
	"offline",
	"timeout",
	"aborted",
	"connection-lost",
] as const;
export type NetworkErrorCode = (typeof NETWORK_ERROR_CODES)[number];

export class NetworkError extends AppError {
	constructor(
		codeOrMessage: NetworkErrorCode | string = "connection-lost",
		options: AppErrorOptions = {},
	) {
		const code = NETWORK_ERROR_CODES.includes(codeOrMessage as NetworkErrorCode)
			? (codeOrMessage as NetworkErrorCode)
			: "connection-lost";
		const message =
			code === codeOrMessage
				? `Network request failed: ${code}`
				: codeOrMessage;
		super(message, code, code !== "aborted", {
			...options,
			category: "network",
			severity: "warn",
		});
	}
}

export function isNetworkError(error: unknown): error is NetworkError {
	return error instanceof NetworkError;
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends AppError {
	constructor(
		message: string = "Request timed out",
		public readonly timeoutMs?: number,
	) {
		super(message, "timeout", true, {
			category: "network",
			severity: "warn",
		});
	}
}

/**
 * Error thrown when the API response format is invalid
 */
export class InvalidResponseError extends AppError {
	constructor(
		message: string = "Invalid response from API",
		options: AppErrorOptions = {},
	) {
		super(message, "invalid-response", true, {
			...options,
			category: "data-integrity",
			severity: "error",
		});
	}
}

function categoryForStatus(status: number, hasValidation: boolean) {
	if (hasValidation || status === 400 || status === 422)
		return "validation" as const;
	if (status === 401 || status === 403) return "access-denied" as const;
	if (status === 404) return "not-found" as const;
	if (status >= 500) return "server-error" as const;
	return "operation-failed" as const;
}

function severityForStatus(status: number, hasValidation: boolean) {
	if (
		hasValidation ||
		status === 400 ||
		status === 401 ||
		status === 403 ||
		status === 422
	) {
		return "info" as const;
	}
	if (status === 404 || status === 409 || status === 429)
		return "warn" as const;
	return "error" as const;
}

function isRetryableStatus(status: number): boolean {
	return status === 408 || status === 425 || status === 429 || status >= 500;
}
