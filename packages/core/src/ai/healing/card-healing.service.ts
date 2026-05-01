import type { IHttpClient } from "../../interfaces/http-client";
import type { TrueRecallSettings } from "../../types/settings.types";
import { buildAIHeaders } from "../clients/openrouter-client";
import { resolveAIClientConfig } from "../config/ai-client-config";
import type { HealCardInput, HealingSuggestion } from "./healing.types";
import {
	buildHealingSystemPrompt,
	buildHealingUserMessage,
} from "./healing-prompt";

export class CardHealingService {
	constructor(
		private getSettings: () => TrueRecallSettings,
		private httpClient: IHttpClient,
	) {}

	async heal(input: HealCardInput): Promise<HealingSuggestion> {
		const settings = this.getSettings();
		const config = resolveAIClientConfig(settings);

		const systemMessage = buildHealingSystemPrompt();
		const userMessage = buildHealingUserMessage(input);

		const body: Record<string, unknown> = {
			model: config.model,
			messages: [
				{ role: "system", content: systemMessage },
				{ role: "user", content: userMessage },
			],
			temperature: 0.7,
		};

		if (config.hasProTier) {
			body.metadata = { call_context: "card-healing" };
		}

		const response = await this.httpClient.post(
			config.baseUrl,
			body,
			buildAIHeaders(config.apiKey, { providerType: config.providerType }),
		);

		const data = response.json as {
			choices?: Array<{ message?: { content?: string } }>;
		};

		const content = data?.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error("No response from AI");
		}

		return this.parseResponse(content);
	}

	private parseResponse(raw: string): HealingSuggestion {
		const cleaned = raw
			.replace(/```json\s*/g, "")
			.replace(/```\s*/g, "")
			.trim();

		try {
			const parsed = JSON.parse(cleaned) as Record<string, unknown>;
			return {
				diagnosis: String(parsed.diagnosis ?? "Unable to diagnose"),
				rewrittenQuestion: parsed.rewrittenQuestion
					? String(parsed.rewrittenQuestion)
					: undefined,
				rewrittenAnswer: parsed.rewrittenAnswer
					? String(parsed.rewrittenAnswer)
					: undefined,
				mnemonic: parsed.mnemonic ? String(parsed.mnemonic) : undefined,
			};
		} catch (cause) {
			throw new Error("Failed to parse healing suggestion", { cause });
		}
	}
}
