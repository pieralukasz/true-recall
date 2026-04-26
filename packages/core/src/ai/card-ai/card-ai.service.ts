import {
	AIRequestError,
	getTextContent,
	type OpenRouterClient,
} from "../clients/openrouter-client";
import {
	CardAIAbortedError,
	CardAIParseError,
	CardAIProviderError,
	type CardAIRequest,
	type CardAIResult,
	type CardFields,
	makeCardAIArrayResponseSchema,
} from "./card-ai.types";
import { buildCardAIMessages } from "./card-ai-prompts";

// Lucas-chosen value (matches "generation" capability default in proxy).
// Located client-side so BYOK users (who bypass the proxy) get the same value.
const CARD_POLISH_TEMPERATURE = 0.7;

export class CardAIService {
	constructor(private readonly client: OpenRouterClient) {}

	async transform(req: CardAIRequest): Promise<CardAIResult> {
		if (req.signal?.aborted) throw new CardAIAbortedError();
		const messages = buildCardAIMessages({
			fields: req.fields,
			prompt: req.prompt,
			context: req.context,
		});

		let response: Awaited<ReturnType<OpenRouterClient["chat"]>>;
		try {
			response = await this.client.chat({
				messages,
				temperature: CARD_POLISH_TEMPERATURE,
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

		const raw = getTextContent(response.choices[0]?.message);
		const parsed = parseFields(raw, Object.keys(req.fields));
		return {
			cards: parsed,
			rawResponse: raw,
			usage: {
				promptTokens: response.usage?.prompt_tokens ?? 0,
				completionTokens: response.usage?.completion_tokens ?? 0,
			},
		};
	}
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
