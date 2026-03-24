import { AIRequestError } from "./openrouter-client";

export function formatAIError(error: unknown): string {
	if (error instanceof AIRequestError) {
		if (error.isRateLimited) {
			return "OpenRouter rate limit exceeded. Try again shortly or check your API key balance.";
		}
		if (error.isUnauthorized) {
			return "OpenRouter API key is invalid. Check your key in settings.";
		}
	}
	return error instanceof Error ? error.message : "Unknown AI error";
}
