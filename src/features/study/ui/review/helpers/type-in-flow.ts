import type { FSRSFlashcardItem } from "@shared/types";

export function isTypeInRequiredForCard(
	card: FSRSFlashcardItem | null,
	typeInModeEnabled: boolean,
): boolean {
	if (!card) return false;
	if (!typeInModeEnabled) return false;
	return !!card.answer?.trim();
}

export function shouldRunAIGradingOnReveal(options: {
	requiresTypeIn: boolean;
	aiEnabled: boolean;
	typedAnswer: string;
	isChecking: boolean;
}): boolean {
	if (!options.requiresTypeIn) return false;
	if (!options.aiEnabled) return false;
	if (options.isChecking) return false;
	return options.typedAnswer.trim().length > 0;
}

export function isRatingLockedForTypeIn(options: {
	requiresTypeIn: boolean;
	isAnswerRevealed: boolean;
	isChecking: boolean;
}): boolean {
	if (!options.requiresTypeIn) return false;
	if (!options.isAnswerRevealed) return false;
	if (options.isChecking) return true;
	return false;
}
