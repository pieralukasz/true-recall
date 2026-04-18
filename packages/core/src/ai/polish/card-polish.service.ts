import {
	AIRequestError,
	getTextContent,
	type OpenRouterClient,
} from "../clients/openrouter-client";
import {
	PolishAbortedError,
	PolishParseError,
	PolishProviderError,
	type PolishRequest,
	PolishResponseSchema,
	type PolishResult,
} from "./card-polish.types";
import { buildPolishMessages } from "./card-polish-prompts";

export class CardPolishService {
	constructor(private readonly client: OpenRouterClient) {}

	async transform(req: PolishRequest): Promise<PolishResult> {
		// Abort is checked pre-call and post-error; mid-flight cancellation would require plumbing AbortSignal into OpenRouterClient.chat.
		if (req.signal?.aborted) throw new PolishAbortedError();

		const messages = buildPolishMessages({
			prompt: req.prompt,
			cardFront: req.cardFront,
			cardBack: req.cardBack,
		});

		let response: Awaited<ReturnType<OpenRouterClient["chat"]>>;
		try {
			response = await this.client.chat({ messages });
		} catch (err) {
			if (req.signal?.aborted) throw new PolishAbortedError();
			if (err instanceof AIRequestError) {
				throw new PolishProviderError(err.message, err);
			}
			throw new PolishProviderError(
				err instanceof Error ? err.message : "Provider request failed",
				err,
			);
		}

		const raw = getTextContent(response.choices[0]?.message);
		const parsed = this.parseResponse(raw);
		const usage = response.usage;

		return {
			front: parsed.front,
			back: parsed.back,
			rawResponse: raw,
			usage: {
				promptTokens: usage?.prompt_tokens ?? 0,
				completionTokens: usage?.completion_tokens ?? 0,
			},
		};
	}

	private parseResponse(raw: string): { front: string; back: string } {
		const parsed = tryParseJsonCandidates(raw);
		if (parsed === undefined) {
			throw new PolishParseError(raw, "LLM did not return valid JSON");
		}
		const result = PolishResponseSchema.safeParse(parsed);
		if (!result.success) {
			throw new PolishParseError(
				raw,
				`Response failed schema validation: ${result.error.message}`,
			);
		}
		return result.data;
	}
}

// Models that should return pure JSON sometimes wrap it in ```json fences or
// add preamble text. Try the raw text first, then progressively strip layers.
function tryParseJsonCandidates(raw: string): unknown {
	const candidates = [raw, stripCodeFence(raw), extractBraceSpan(raw)];
	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			return JSON.parse(candidate);
		} catch {
			// try next candidate
		}
	}
	return undefined;
}

function stripCodeFence(text: string): string | null {
	const match = text
		.trim()
		.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
	return match?.[1] ? match[1].trim() : null;
}

function extractBraceSpan(text: string): string | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	return text.slice(start, end + 1);
}
