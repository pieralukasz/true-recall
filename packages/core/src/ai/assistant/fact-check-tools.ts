import type { ToolDefinition } from "../clients/openrouter-client";
import type {
	FactCheckConfidence,
	FactCheckEvidence,
	FactCheckResult,
	FactCheckVerdict,
} from "./assistant.types";
import { ASSISTANT_TOOLS } from "./assistant-tools";

export const FACT_CHECK_VERDICTS: readonly FactCheckVerdict[] = [
	"confirmed",
	"incorrect",
	"outdated",
	"unverifiable",
];

export const FACT_CHECK_CONFIDENCES: readonly FactCheckConfidence[] = [
	"high",
	"medium",
	"low",
];

/** Evidence quotes are excerpts, not article dumps. */
const MAX_QUOTE_LENGTH = 300;

/**
 * Returned to the model when it tries to edit the card before reporting a
 * verdict that justifies an edit. Enforced in code so a chatty model cannot
 * "fix" a card it has just confirmed.
 */
export const FACT_CHECK_CORRECTION_GATE_MESSAGE =
	"Call report_fact_check first; corrections are only allowed after an incorrect or outdated verdict.";

export const REPORT_FACT_CHECK_TOOL: ToolDefinition = {
	type: "function",
	function: {
		name: "report_fact_check",
		description:
			"Report the verdict of the fact check of CURRENT CARD. Call exactly once. Every verdict except unverifiable requires at least one evidence URL from the web search results.",
		parameters: {
			type: "object",
			properties: {
				verdict: { type: "string", enum: [...FACT_CHECK_VERDICTS] },
				confidence: { type: "string", enum: [...FACT_CHECK_CONFIDENCES] },
				summary: {
					type: "string",
					description:
						"2 to 4 sentences: which claims were checked and why the verdict follows",
				},
				evidence: {
					type: "array",
					items: {
						type: "object",
						properties: {
							url: { type: "string" },
							title: { type: "string" },
							quote: {
								type: "string",
								description:
									"Short passage supporting the verdict, at most 300 characters",
							},
						},
						required: ["url"],
					},
				},
			},
			required: ["verdict", "confidence", "summary", "evidence"],
		},
	},
};

/** Assistant tools that stay available while fact-checking: card edits and read-only lookups. */
const FACT_CHECK_ASSISTANT_TOOL_NAMES = new Set([
	"update_proposal",
	"remove_proposal",
	"update_card",
	"read_note",
	"get_related_cards",
]);

export function buildFactCheckTools(): ToolDefinition[] {
	return [
		REPORT_FACT_CHECK_TOOL,
		...ASSISTANT_TOOLS.filter((tool) =>
			FACT_CHECK_ASSISTANT_TOOL_NAMES.has(tool.function.name),
		),
	];
}

export type FactCheckReportParse =
	| { ok: true; result: FactCheckResult }
	| { ok: false; error: string };

function isVerdict(value: unknown): value is FactCheckVerdict {
	return (
		typeof value === "string" &&
		(FACT_CHECK_VERDICTS as readonly string[]).includes(value)
	);
}

function isConfidence(value: unknown): value is FactCheckConfidence {
	return (
		typeof value === "string" &&
		(FACT_CHECK_CONFIDENCES as readonly string[]).includes(value)
	);
}

function readEvidence(raw: unknown): FactCheckEvidence[] {
	if (!Array.isArray(raw)) return [];
	const evidence: FactCheckEvidence[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const url = typeof record.url === "string" ? record.url.trim() : "";
		if (!/^https?:\/\//i.test(url)) continue;
		const entry: FactCheckEvidence = { url };
		const title = typeof record.title === "string" ? record.title.trim() : "";
		if (title) entry.title = title;
		const quote = typeof record.quote === "string" ? record.quote.trim() : "";
		if (quote) entry.quote = quote.slice(0, MAX_QUOTE_LENGTH);
		evidence.push(entry);
	}
	return evidence;
}

/** Validates the model's report_fact_check arguments. Errors are phrased for the model, which retries. */
export function parseFactCheckReport(
	args: Record<string, unknown>,
): FactCheckReportParse {
	if (!isVerdict(args.verdict)) {
		return {
			ok: false,
			error: `Invalid verdict "${String(args.verdict)}". Use one of: ${FACT_CHECK_VERDICTS.join(", ")}.`,
		};
	}
	if (!isConfidence(args.confidence)) {
		return {
			ok: false,
			error: `Invalid confidence "${String(args.confidence)}". Use one of: ${FACT_CHECK_CONFIDENCES.join(", ")}.`,
		};
	}
	const summary = typeof args.summary === "string" ? args.summary.trim() : "";
	if (!summary) {
		return { ok: false, error: "Provide a non-empty summary." };
	}
	const evidence = readEvidence(args.evidence);
	if (args.verdict !== "unverifiable" && evidence.length === 0) {
		return {
			ok: false,
			error:
				"Provide at least one source URL in evidence, or report unverifiable.",
		};
	}
	return {
		ok: true,
		result: {
			verdict: args.verdict,
			confidence: args.confidence,
			summary,
			evidence,
		},
	};
}

export function allowsCorrection(
	verdict: FactCheckVerdict | undefined,
): boolean {
	return verdict === "incorrect" || verdict === "outdated";
}
