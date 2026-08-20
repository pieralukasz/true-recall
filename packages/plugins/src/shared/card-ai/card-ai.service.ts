import {
	AIRequestError,
	type ChatMessage,
	getTextContent,
	type OpenRouterClient,
} from "@true-recall/core/ai/clients/openrouter-client";

import {
	CardAIAbortedError,
	CardAIParseError,
	CardAIProviderError,
	type CardAIRequest,
	type CardAIResult,
	type CardFields,
	deepEqualFields,
	makeCardAIArrayResponseSchema,
} from "./card-ai.types";
import { buildCardAIMessages } from "./card-ai-prompts";

const DEFAULT_CARD_POLISH_TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 4096;

export class CardAIService {
	constructor(private readonly client: OpenRouterClient) {}

	async transform(req: CardAIRequest): Promise<CardAIResult> {
		if (req.signal?.aborted) throw new CardAIAbortedError();
		let messages = buildCardAIMessages({
			fields: req.fields,
			noteType: req.noteType,
			prompt: req.prompt,
			operation: req.operation,
			mode: req.mode,
			fieldScope: req.fieldScope,
			context: req.context,
		});

		let promptTokens = 0;
		let completionTokens = 0;
		for (let attempt = 0; attempt < 2; attempt++) {
			let response: Awaited<ReturnType<OpenRouterClient["chat"]>>;
			try {
				response = await this.client.chat({
					messages,
					temperature: req.temperature ?? DEFAULT_CARD_POLISH_TEMPERATURE,
					max_tokens: MAX_OUTPUT_TOKENS,
				});
			} catch (err) {
				if (req.signal?.aborted) throw new CardAIAbortedError();
				if (err instanceof AIRequestError) {
					throw new CardAIProviderError(err.message, err);
				}
				throw new CardAIProviderError(
					err instanceof Error ? err.message : "Provider request failed",
					err,
				);
			}

			promptTokens += response.usage?.prompt_tokens ?? 0;
			completionTokens += response.usage?.completion_tokens ?? 0;
			const raw = getTextContent(response.choices[0]?.message);
			try {
				const parsed = enforceResultContract(
					parseFields(raw, Object.keys(req.fields)),
					req,
					raw,
				);
				return {
					cards: parsed,
					rawResponse: raw,
					usage: { promptTokens, completionTokens },
				};
			} catch (error) {
				if (!(error instanceof CardAIParseError)) throw error;
				if (attempt === 0) {
					messages = repairMessages(messages, raw, error, req);
					continue;
				}
				if (isSafeNoOpFailure(error, req)) {
					return {
						cards: [{ ...req.fields }],
						rawResponse: raw,
						usage: { promptTokens, completionTokens },
					};
				}
				throw error;
			}
		}

		throw new CardAIParseError("", "Card Polish could not produce a result");
	}
}

function repairMessages(
	messages: ChatMessage[],
	raw: string,
	error: CardAIParseError,
	req: Pick<CardAIRequest, "fields" | "mode">,
): ChatMessage[] {
	const noOpRule =
		req.mode === "edit"
			? ""
			: ` If the requested ${req.mode} is not meaningful, return one element equal to the original card verbatim.`;
	return [
		...messages,
		{ role: "assistant", content: raw },
		{
			role: "user",
			content: `Your previous response violated the required Card Polish contract: ${error.message}. Correct it now. Return only the required JSON array.${noOpRule}\n\nOriginal card:\n${JSON.stringify(req.fields)}`,
		},
	];
}

function isSafeNoOpFailure(
	error: CardAIParseError,
	req: Pick<CardAIRequest, "mode">,
): boolean {
	return (
		(req.mode === "split" || req.mode === "spawn") &&
		error.message.includes("expected at least two cards")
	);
}

function editableFieldNames(
	req: Pick<CardAIRequest, "fields" | "fieldScope">,
): Set<string> {
	if (req.fieldScope === "all") return new Set(Object.keys(req.fields));
	const names = Object.keys(req.fields);
	const selected =
		req.fieldScope === "question" ? names[0] : (names[1] ?? names[0]);
	return new Set(selected ? [selected] : []);
}

export function enforceResultContract(
	cards: CardFields[],
	req: Pick<CardAIRequest, "fields" | "mode" | "fieldScope">,
	rawResponse = JSON.stringify(cards),
): CardFields[] {
	if (req.mode === "edit" && cards.length !== 1) {
		throw new CardAIParseError(
			rawResponse,
			`EDIT mode expected exactly one card, received ${cards.length}`,
		);
	}
	if (
		(req.mode === "spawn" || req.mode === "split") &&
		cards.length === 1 &&
		deepEqualFields(cards[0] ?? {}, req.fields)
	) {
		return cards;
	}
	if ((req.mode === "spawn" || req.mode === "split") && cards.length < 2) {
		throw new CardAIParseError(
			rawResponse,
			`${req.mode.toUpperCase()} mode expected at least two cards`,
		);
	}
	if (req.mode === "spawn" && !deepEqualFields(cards[0] ?? {}, req.fields)) {
		throw new CardAIParseError(
			rawResponse,
			"SPAWN mode changed the source card",
		);
	}

	if (req.mode !== "edit" || req.fieldScope === "all") return cards;
	const editable = editableFieldNames(req);
	const head = cards[0];
	if (!head) return cards;
	return [
		Object.fromEntries(
			Object.keys(req.fields).map((name) => [
				name,
				editable.has(name) ? (head[name] ?? "") : (req.fields[name] ?? ""),
			]),
		),
	];
}

function parseFields(raw: string, fieldNames: string[]): CardFields[] {
	const candidate = tryJsonCandidates(raw);
	if (candidate === undefined)
		throw new CardAIParseError(raw, "LLM did not return valid JSON");
	const schema = makeCardAIArrayResponseSchema(fieldNames);
	const result = schema.safeParse(candidate);
	if (!result.success) {
		throw new CardAIParseError(
			raw,
			`Schema validation failed: ${result.error.message}`,
		);
	}
	return result.data;
}

function tryJsonCandidates(raw: string): unknown {
	for (const c of [raw, stripFence(raw), extractArraySpan(raw)]) {
		if (!c) continue;
		try {
			return JSON.parse(c);
		} catch (err) {
			// Intentional fall-through: each candidate is a heuristic stripping of
			// fences/preamble. Only the last parse failure matters for diagnostics,
			// and the caller surfaces it via CardAIParseError with the raw response.
			void err;
		}
	}
	return undefined;
}

function stripFence(text: string): string | null {
	const m = text.trim().match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
	return m?.[1] ? m[1].trim() : null;
}

// Extract a JSON array from prose by anchoring on `[\s*{` (array-of-objects start)
// and `}\s*]` (array-of-objects end). The leading `{` anchor rejects prose
// patterns like "cards: [1] foo" where `[` is not followed by JSON.
function extractArraySpan(text: string): string | null {
	const startMatch = text.match(/\[\s*\{/);
	if (!startMatch || startMatch.index === undefined) return null;
	const start = startMatch.index;
	const endMatches = text.slice(start).match(/\}\s*\]/g);
	if (!endMatches?.length) return null;
	const lastEnd = endMatches[endMatches.length - 1];
	if (!lastEnd) return null;
	const lastEndIdx = text.lastIndexOf(lastEnd);
	if (lastEndIdx === -1) return null;
	return text.slice(start, lastEndIdx + lastEnd.length);
}
