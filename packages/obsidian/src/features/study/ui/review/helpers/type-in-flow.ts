import { type Grade, Rating } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	SuggestedRating,
} from "@true-recall/core/types";

export type TypeInMode = "off" | "ai";

export function deriveTypeInMode(typeInModeEnabled: boolean): TypeInMode {
	return typeInModeEnabled ? "ai" : "off";
}

export function nextTypeInMode(mode: TypeInMode, skipOff = false): TypeInMode {
	if (mode === "off") return "ai";
	return skipOff ? "ai" : "off";
}

export function isTypeInRequiredForCard(
	card: FSRSFlashcardItem | null,
	typeInModeEnabled: boolean,
): boolean {
	if (!card) return false;
	if (card.cardType === "image-occlusion" || card.cardType === "note-review")
		return false;
	if (!card.answer?.trim()) return false;
	if (card.alwaysTypeIn || card.fsrs.alwaysTypeIn) return true;
	if (!typeInModeEnabled) return false;
	return true;
}

export function shouldRunAIGradingOnReveal(options: {
	requiresTypeIn: boolean;
	typedAnswer: string;
	isChecking: boolean;
}): boolean {
	if (!options.requiresTypeIn) return false;
	if (options.isChecking) return false;
	return options.typedAnswer.trim().length > 0;
}

export function isRatingLockedForTypeIn(options: {
	requiresTypeIn: boolean;
	isAnswerRevealed: boolean;
	isChecking: boolean;
}): boolean {
	if (!options.requiresTypeIn) return false;
	// Grading runs before the reveal in the two-stage flow, so the lock
	// applies whenever a check is in flight, revealed or not.
	return options.isChecking;
}

const SUGGESTED_RATING_TO_GRADE: Record<SuggestedRating, Grade> = {
	again: Rating.Again,
	hard: Rating.Hard,
	good: Rating.Good,
	easy: Rating.Easy,
};

export function suggestedRatingToGrade(
	suggested: SuggestedRating | null | undefined,
): Grade | null {
	if (!suggested) return null;
	return SUGGESTED_RATING_TO_GRADE[suggested] ?? null;
}
