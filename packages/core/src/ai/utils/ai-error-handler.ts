import { describeErrorForUser, isHttpError } from "../../errors";

export function formatAIError(error: unknown): string {
	if (isHttpError(error)) {
		if (error.statusCode === 429) {
			return "OpenRouter rate limit exceeded. Try again shortly or check your API key balance.";
		}
		if (error.statusCode === 401) {
			return "OpenRouter API key is invalid. Check your key in settings.";
		}
	}
	return describeErrorForUser(error);
}
