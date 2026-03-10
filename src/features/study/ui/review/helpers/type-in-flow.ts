import type { FSRSFlashcardItem } from "@shared/types";

export type TypeInMode = "off" | "ai" | "diff";

export function deriveTypeInMode(
	typeInModeEnabled: boolean,
	aiEnabled: boolean,
): TypeInMode {
	if (!typeInModeEnabled) return "off";
	return aiEnabled ? "ai" : "diff";
}

export function nextTypeInMode(mode: TypeInMode, skipOff = false): TypeInMode {
	if (mode === "off") return "ai";
	if (mode === "ai") return "diff";
	return skipOff ? "ai" : "off";
}

export function isTypeInRequiredForCard(
	card: FSRSFlashcardItem | null,
	typeInModeEnabled: boolean,
): boolean {
	if (!card) return false;
	if (card.cardType === "image-occlusion") return false;
	if (!card.answer?.trim()) return false;
	if (card.alwaysTypeIn || card.fsrs.alwaysTypeIn) return true;
	if (!typeInModeEnabled) return false;
	return true;
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
