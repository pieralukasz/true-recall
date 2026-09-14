import { describeErrorForUser, isHttpError, toAppError } from "../../errors";

export function formatAIError(error: unknown): string {
	const appError = toAppError(error);
	if (isHttpError(appError)) {
		if (appError.statusCode === 429) {
			return "OpenRouter rate limit exceeded. Try again shortly or check your API key balance.";
		}
		if (appError.statusCode === 401) {
			return "OpenRouter API key is invalid. Check your key in settings.";
		}
	}
	return describeErrorForUser(error);
}
