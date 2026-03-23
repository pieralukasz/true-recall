import type { AITier } from "@shared/types/settings.types";
import { AIRequestError } from "./openrouter-client";

export function formatAIError(error: unknown, tier: AITier): string {
	if (error instanceof AIRequestError) {
		if (error.isBudgetExceeded && tier === "pro") {
			return "Monthly AI budget exhausted. The model will automatically switch to a lighter alternative. If issues persist, add an OpenRouter API key as backup.";
		}
		if (error.isUnauthorized && tier === "pro") {
			return "True Recall Pro subscription key is invalid. Please re-authenticate in settings.";
		}
		if (error.isBudgetExceeded && tier === "byok") {
			return "OpenRouter rate limit exceeded. Try again shortly or check your API key balance.";
		}
		if (error.isUnauthorized && tier === "byok") {
			return "OpenRouter API key is invalid. Check your key in settings.";
		}
	}
	return error instanceof Error ? error.message : "Unknown AI error";
}
