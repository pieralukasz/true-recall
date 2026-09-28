import { LocalApiError } from "./client.js";

/**
 * Error details plus a hint that tells an agent what it (or the user) can do
 * about the failure. Shared by the MCP server and the CLI so both give the
 * same diagnosis for the same failure.
 */
export type ExplainedError = {
	error: string;
	status?: number;
	code?: string;
	retryable?: boolean;
	requestId?: string;
	hint?: string;
};

const HINTS: Record<string, string> = {
	unauthorized:
		"TRUE_RECALL_TOKEN is missing or wrong. The user copies the token from Obsidian: Settings → True Recall → Integrations → Local API.",
	unreachable:
		"Ask the user to open Obsidian and turn on Settings → True Recall → Integrations → Enable local API. If it is on, check TRUE_RECALL_PORT (default 27182).",
	timeout:
		"The plugin did not answer in time. Retry once; long jobs such as optimize_parameters can take minutes.",
	"sql-query-disabled":
		"The user has to turn on Settings → True Recall → Integrations → Enable SQL query endpoint. Retrying will not help.",
};

export function explainError(error: unknown): ExplainedError {
	if (!(error instanceof LocalApiError)) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
	const out: ExplainedError = { error: error.message };
	if (error.status) out.status = error.status;
	if (error.code) out.code = error.code;
	if (error.retryable) out.retryable = true;
	if (error.requestId) out.requestId = error.requestId;
	const hint =
		(error.code ? HINTS[error.code] : undefined) ??
		(error.status === 503
			? "The plugin is still loading its database; retry in a few seconds."
			: undefined);
	if (hint) out.hint = hint;
	return out;
}

/** Text form for MCP error results: the message, then the hint. */
export function formatError(error: unknown): string {
	const e = explainError(error);
	const meta = [
		e.status ? `HTTP ${e.status}` : undefined,
		e.code ? `code ${e.code}` : undefined,
	].filter(Boolean);
	const head = meta.length > 0 ? `${e.error} (${meta.join(", ")})` : e.error;
	return e.hint ? `${head}\n${e.hint}` : head;
}
