import { HttpError, type ValidationFieldIssues } from "./api.error";

interface ErrorEnvelope {
	code?: unknown;
	message?: unknown;
	detail?: unknown;
	fields?: unknown;
	retryable?: unknown;
	correlationId?: unknown;
	correlation_id?: unknown;
	error?: unknown;
}

export interface HttpFailureContext {
	provider?: string;
	method?: string;
	route?: string;
	requestId?: string;
	cause?: unknown;
}

export function fromHttpResponse(
	statusCode: number,
	body: unknown,
	context: HttpFailureContext = {},
): HttpError {
	const root = asObject(body);
	const nested = asObject(root?.error);
	const envelope = (nested ?? root) as ErrorEnvelope | undefined;
	const requestId =
		context.requestId ??
		readString(envelope?.correlationId) ??
		readString(envelope?.correlation_id);

	return new HttpError(statusCode, {
		backendCode: readString(envelope?.code),
		detail:
			readString(envelope?.message) ??
			readString(envelope?.detail) ??
			(typeof root?.error === "string" ? root.error : undefined),
		validation: readValidation(envelope?.fields),
		retryable:
			typeof envelope?.retryable === "boolean" ? envelope.retryable : undefined,
		requestId,
		provider: context.provider,
		cause: context.cause,
		context: compactContext(context),
	});
}

function compactContext(
	context: HttpFailureContext,
): Record<string, string> | undefined {
	const result: Record<string, string> = {};
	if (context.provider) result.provider = context.provider;
	if (context.method) result.method = context.method;
	if (context.route) result.route = context.route;
	return Object.keys(result).length > 0 ? result : undefined;
}

function readValidation(value: unknown): ValidationFieldIssues | undefined {
	const fields = asObject(value);
	if (!fields) return undefined;
	const result: ValidationFieldIssues = {};
	for (const [field, messages] of Object.entries(fields)) {
		if (typeof messages === "string") result[field] = [messages];
		else if (Array.isArray(messages)) {
			const strings = messages.filter(
				(message): message is string => typeof message === "string",
			);
			if (strings.length > 0) result[field] = strings;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}
