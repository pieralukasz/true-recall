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

		const usage = (
			response as unknown as {
				usage?: { prompt_tokens?: number; completion_tokens?: number };
			}
		).usage;

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
		let asJson: unknown;
		try {
			asJson = JSON.parse(raw);
		} catch {
			throw new PolishParseError(raw, "LLM did not return valid JSON");
		}
		const result = PolishResponseSchema.safeParse(asJson);
		if (!result.success) {
			throw new PolishParseError(
				raw,
				`Response failed schema validation: ${result.error.message}`,
			);
		}
		return result.data;
	}
}
