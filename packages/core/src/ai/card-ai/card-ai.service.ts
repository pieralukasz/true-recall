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
	makeCardAIResponseSchema,
} from "./card-ai.types";
import { buildCardAIMessages } from "./card-ai-prompts";

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
			response = await this.client.chat({ messages });
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
			fields: parsed,
			rawResponse: raw,
			usage: {
				promptTokens: response.usage?.prompt_tokens ?? 0,
				completionTokens: response.usage?.completion_tokens ?? 0,
			},
		};
	}
}

function parseFields(raw: string, fieldNames: string[]): CardFields {
	const candidate = tryJsonCandidates(raw);
	if (candidate === undefined)
		throw new CardAIParseError(raw, "LLM did not return valid JSON");
	const schema = makeCardAIResponseSchema(fieldNames);
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
	for (const c of [raw, stripFence(raw), extractBraceSpan(raw)]) {
		if (!c) continue;
		try {
			return JSON.parse(c);
		} catch {
			// next
		}
	}
	return undefined;
}

function stripFence(text: string): string | null {
	const m = text.trim().match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
	return m?.[1] ? m[1].trim() : null;
}

function extractBraceSpan(text: string): string | null {
	const s = text.indexOf("{");
	const e = text.lastIndexOf("}");
	if (s === -1 || e <= s) return null;
	return text.slice(s, e + 1);
}
